"""Stream only public crash rows from an InfoSiga ZIP; never open person/vehicle files."""
import csv
import datetime
import hashlib
import io
import json
import math
import sys
import zipfile

FILES = {
    # This file contains six valid pedestrian records dated 2014.
    "sinistros_2015-2021.csv": (2014, 2021),
    "sinistros_2022-2024.csv": (2022, 2024),
    "sinistros_2025-2026.csv": (2025, 2026),
}
REQUIRED = {
    "id_sinistro", "tipo_registro", "data_sinistro", "latitude", "longitude",
    "municipio", "qtd_pedestre", "tp_sinistro_atrop_pedestre",
}
TYPES = {"SINISTRO FATAL", "SINISTRO NAO FATAL", "NOTIFICACAO"}
# Bounding envelope of the state, not a municipal or state boundary polygon.
BOUNDS = (-53.3, -25.4, -44.0, -19.7)


def write(item):
    sys.stdout.write(json.dumps(item, ensure_ascii=True, separators=(",", ":")) + "\n")


def extract(path):
    stats = {"scanned": 0, "relevant": 0, "withoutCoordinates": 0,
             "outsideBounds": 0, "features": 0, "municipalities": {}}
    csv.field_size_limit(65536)
    with zipfile.ZipFile(path) as archive:
        infos = archive.infolist()
        names = [info.filename for info in infos]
        if any(names.count(name) != 1 for name in FILES):
            raise ValueError("INFOSIGA_MISSING_OR_DUPLICATE_FILE")
        selected = [archive.getinfo(name) for name in FILES]
        if sum(info.file_size for info in selected) > 500_000_000:
            raise ValueError("INFOSIGA_FILE_LIMIT")
        for info in selected:
            if info.flag_bits & 1 or info.file_size > 200_000_000:
                raise ValueError("INFOSIGA_FILE_LIMIT")
            years = FILES[info.filename]
            with archive.open(info) as raw:
                reader = csv.DictReader(io.TextIOWrapper(raw, encoding="cp1252", newline=""), delimiter=";", strict=True)
                if not reader.fieldnames or not REQUIRED.issubset(reader.fieldnames) or len(set(reader.fieldnames)) != len(reader.fieldnames):
                    raise ValueError("INFOSIGA_SCHEMA_CHANGED")
                for row in reader:
                    stats["scanned"] += 1
                    if None in row or any(row.get(key) is None for key in REQUIRED):
                        raise ValueError("INFOSIGA_COLUMN_MISMATCH")
                    quantity = row["qtd_pedestre"].strip()
                    flag = row["tp_sinistro_atrop_pedestre"].strip().upper()
                    if quantity and (not quantity.isascii() or not quantity.isdigit()):
                        raise ValueError("INFOSIGA_PEDESTRIAN_FORMAT")
                    if flag not in ("", "S", "N"):
                        raise ValueError("INFOSIGA_PEDESTRIAN_FORMAT")
                    if not ((quantity and int(quantity) > 0) or flag == "S"):
                        continue
                    stats["relevant"] += 1
                    event_id = row["id_sinistro"].strip()
                    record_type = row["tipo_registro"].strip().upper()
                    if not event_id.isascii() or not event_id.isdigit() or len(event_id) > 128 or record_type not in TYPES:
                        raise ValueError("INFOSIGA_EVENT_FORMAT")
                    date = datetime.datetime.strptime(row["data_sinistro"].strip(), "%d/%m/%Y").date()
                    if not years[0] <= date.year <= years[1]:
                        raise ValueError("INFOSIGA_DATE_OUTSIDE_PERIOD")
                    municipality = row["municipio"].strip()
                    if not municipality or len(municipality) > 120:
                        raise ValueError("INFOSIGA_MUNICIPALITY_FORMAT")
                    city = stats["municipalities"].setdefault(municipality, {
                        "relevant": 0, "valid": 0, "missing": 0, "outside": 0,
                    })
                    city["relevant"] += 1
                    try:
                        latitude = float(row["latitude"].strip().replace(",", "."))
                        longitude = float(row["longitude"].strip().replace(",", "."))
                        if not math.isfinite(latitude) or not math.isfinite(longitude):
                            raise ValueError("non-finite")
                    except ValueError:
                        stats["withoutCoordinates"] += 1
                        city["missing"] += 1
                        continue
                    if not (BOUNDS[0] <= longitude <= BOUNDS[2] and BOUNDS[1] <= latitude <= BOUNDS[3]):
                        stats["outsideBounds"] += 1
                        city["outside"] += 1
                        continue
                    city["valid"] += 1
                    # The raw event identifier, free text, victim and vehicle information never leave this process.
                    external_id = hashlib.sha256(event_id.encode("ascii")).hexdigest()
                    write({"kind": "feature", "externalId": external_id, "latitude": latitude,
                           "longitude": longitude, "date": date.isoformat(),
                           "municipality": municipality, "recordType": record_type})
                    stats["features"] += 1
    if stats["scanned"] == 0 or stats["features"] == 0:
        raise ValueError("INFOSIGA_EMPTY")
    write({"kind": "complete", "stats": stats})


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("INFOSIGA_ARGUMENTS")
        extract(sys.argv[1])
    except BrokenPipeError:
        sys.exit(1)
    except Exception as exc:
        code = str(exc) if isinstance(exc, ValueError) and str(exc).startswith("INFOSIGA_") else "INFOSIGA_EXTRACTION_FAILED"
        sys.stderr.write(code + "\n")
        sys.exit(1)
