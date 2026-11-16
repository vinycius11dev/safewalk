"""Stream street-crime rows from SSP-SP workbooks; never output names, addresses or BO numbers."""
import datetime
import hashlib
import json
import math
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REQUIRED = {
    "NOME_DELEGACIA", "NUM_BO", "ANO_BO", "DATA_OCORRENCIA_BO", "HORA_OCORRENCIA_BO", "DESC_PERIODO",
    "DESCR_TIPOLOCAL", "LATITUDE", "LONGITUDE", "NATUREZA_APURADA", "DESCR_CONDUTA",
}
CATEGORIES = {
    "ROUBO - OUTROS": "robbery",
    "LATROCINIO": "robbery",
    "FURTO - OUTROS": "theft",
    "LESAO CORPORAL DOLOSA": "assault",
    "TENTATIVA DE HOMICIDIO": "assault",
    "HOMICIDIO DOLOSO": "assault",
    "LESAO CORPORAL SEGUIDA DE MORTE": "assault",
    "ESTUPRO": "sexual",
    "ESTUPRO DE VULNERAVEL": "sexual",
}
# Subtractions from cars, homes or shops are not a risk to someone walking along the street.
EXCLUDED_CONDUCTS = {
    "VEICULO", "INTERIOR DE VEICULO", "RESIDENCIA", "FIOS E CABOS", "CARGA", "ESTABELECIMENTO COMERCIAL",
    "INTERIOR ESTABELECIMENTO", "ESTABELECIMENTO-OUTROS", "ESTABELECIMENTO ENSINO", "CONDOMINIO RESIDENCIAL",
    "CONDOMINIO COMERCIAL", "CAIXA ELETRONICO", "DERIVACAO CLANDESTINA", "JOALHERIA",
    "ESTABELECIMENTO BANCARIO (ROUBO/FURTO A BANCO)",
}
PERIODS = {"DE MADRUGADA": "dawn", "PELA MANHA": "morning", "A TARDE": "afternoon", "A NOITE": "night"}
HOUR_PERIODS = ("dawn", "morning", "afternoon", "night")
EXCEL_EPOCH = datetime.date(1899, 12, 30)
FIRST_DATE = datetime.date(2022, 1, 1)
MAX_XML_BYTES = 4_000_000_000


def write(item):
    sys.stdout.write(json.dumps(item, ensure_ascii=True, separators=(",", ":")) + "\n")


def normalize(value):
    if value is None:
        return ""
    text = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in text if not unicodedata.combining(ch)).strip().upper()


def column_index(reference):
    index = 0
    for char in reference:
        if not char.isalpha():
            break
        index = index * 26 + ord(char.upper()) - 64
    return index - 1


def shared_strings(archive):
    strings = []
    with archive.open("xl/sharedStrings.xml") as raw:
        for _, element in ET.iterparse(raw):
            if element.tag == NS + "si":
                strings.append("".join(part.text or "" for part in element.iter(NS + "t")))
                element.clear()
    return strings


def occurred_on(value):
    try:
        date = EXCEL_EPOCH + datetime.timedelta(days=int(float(value)))
    except (TypeError, ValueError, OverflowError):
        return None
    return date if FIRST_DATE <= date <= datetime.date.today() else None


def day_period(label, hour):
    named = PERIODS.get(normalize(label))
    if named:
        return named
    try:
        fraction = float(hour)
    except (TypeError, ValueError):
        return None
    # A blank time is often stored as midnight; it does not say when the event happened.
    if not 0.0007 < fraction < 1:
        return None
    return HOUR_PERIODS[math.floor(fraction * 24 / 6)]


def coordinate(value):
    try:
        number = float(str(value).replace(",", "."))
    except ValueError:
        return None
    return number if math.isfinite(number) and number != 0 else None


def rows(archive, name, strings):
    with archive.open(name) as raw:
        context = ET.iterparse(raw, events=("start", "end"))
        _, root = next(context)
        for event, element in context:
            if event != "end" or element.tag != NS + "row":
                continue
            row = {}
            for cell in element.findall(NS + "c"):
                value = cell.find(NS + "v")
                if value is not None and value.text is not None:
                    row[column_index(cell.get("r"))] = (
                        strings[int(value.text)] if cell.get("t") == "s" else value.text
                    )
            root.clear()
            yield row


def extract(paths, bounds):
    west, south, east, north = bounds
    stats = {"files": len(paths), "scanned": 0, "relevant": 0, "withoutCoordinates": 0,
             "outsideBounds": 0, "invalidDate": 0, "duplicates": 0, "features": 0,
             "firstDate": None, "lastDate": None}
    seen = set()
    for path in paths:
        with zipfile.ZipFile(path) as archive:
            names = [n for n in archive.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)]
            if any(info.flag_bits & 1 for info in archive.infolist()):
                raise ValueError("SSP_ENCRYPTED_FILE")
            if sum(archive.getinfo(name).file_size for name in names) > MAX_XML_BYTES:
                raise ValueError("SSP_FILE_LIMIT")
            strings = shared_strings(archive)
            used_sheets = 0
            for name in sorted(names):
                header = None
                for row in rows(archive, name, strings):
                    if header is None:
                        header = {value: key for key, value in row.items()}
                        if not REQUIRED.issubset(header):
                            break
                        used_sheets += 1
                        continue
                    stats["scanned"] += 1
                    field = lambda key: row.get(header[key])
                    category = CATEGORIES.get(normalize(field("NATUREZA_APURADA")))
                    if not category or normalize(field("DESCR_TIPOLOCAL")) != "VIA PUBLICA":
                        continue
                    if normalize(field("DESCR_CONDUTA")) in EXCLUDED_CONDUCTS:
                        continue
                    stats["relevant"] += 1
                    latitude = coordinate(field("LATITUDE"))
                    longitude = coordinate(field("LONGITUDE"))
                    if latitude is None or longitude is None:
                        stats["withoutCoordinates"] += 1
                        continue
                    if not (west <= longitude <= east and south <= latitude <= north):
                        stats["outsideBounds"] += 1
                        continue
                    date = occurred_on(field("DATA_OCORRENCIA_BO"))
                    if date is None:
                        stats["invalidDate"] += 1
                        continue
                    key = "|".join(str(field(k) or "") for k in ("NOME_DELEGACIA", "ANO_BO", "NUM_BO")) + "|" + category
                    # Only this one-way digest leaves the process; the BO number itself never does.
                    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
                    if digest in seen:
                        stats["duplicates"] += 1
                        continue
                    seen.add(digest)
                    iso = date.isoformat()
                    stats["features"] += 1
                    stats["firstDate"] = min(stats["firstDate"] or iso, iso)
                    stats["lastDate"] = max(stats["lastDate"] or iso, iso)
                    write({"kind": "feature", "externalId": digest, "latitude": latitude,
                           "longitude": longitude, "date": iso, "category": category,
                           "period": day_period(field("DESC_PERIODO"), field("HORA_OCORRENCIA_BO"))})
            if not used_sheets:
                raise ValueError("SSP_SCHEMA_CHANGED")
    if not stats["features"]:
        raise ValueError("SSP_EMPTY")
    write({"kind": "complete", "stats": stats})


def main():
    try:
        if len(sys.argv) < 6:
            raise ValueError("SSP_ARGUMENTS")
        extract(sys.argv[5:], tuple(float(value) for value in sys.argv[1:5]))
    except Exception as exc:  # The caller only receives a stable code, never a data row.
        code = str(exc) if isinstance(exc, ValueError) and str(exc).startswith("SSP_") else "SSP_EXTRACTION_FAILED"
        sys.stderr.write(code + "\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
