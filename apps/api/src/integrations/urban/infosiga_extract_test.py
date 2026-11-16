import contextlib
import csv
import io
import json
import os
import tempfile
import unittest
import zipfile

import infosiga_extract as extractor


def make_csv(rows, omit=None):
    columns = ["id_sinistro", "tipo_registro", "data_sinistro", "latitude", "longitude",
               "municipio", "qtd_pedestre", "tp_sinistro_atrop_pedestre", "logradouro"]
    columns = [column for column in columns if column != omit]
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, columns, delimiter=";", extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("cp1252")


def row(event_id, date, latitude="-23.6", longitude="-46.7", count="1", flag="S"):
    return {"id_sinistro": event_id, "tipo_registro": "NOTIFICACAO", "data_sinistro": date,
            "latitude": latitude, "longitude": longitude, "municipio": "TABOAO DA SERRA",
            "qtd_pedestre": count, "tp_sinistro_atrop_pedestre": flag,
            "logradouro": "DADO PRIVADO NÃO COPIAR"}


class InfosigaExtractorTest(unittest.TestCase):
    def write_zip(self, directory, missing_field=None):
        path = os.path.join(directory, "fixture.zip")
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("sinistros_2015-2021.csv", make_csv([
                row("123456789", "31/12/2014"), row("7", "01/01/2016", count="", flag=""),
            ], missing_field))
            archive.writestr("sinistros_2022-2024.csv", make_csv([
                row("123456790", "02/01/2023", latitude=""),
            ], missing_field))
            archive.writestr("sinistros_2025-2026.csv", make_csv([
                row("123456791", "15/03/2026", longitude="-2"),
                row("123456792", "15/03/2026", count="", flag="S"),
            ], missing_field))
            archive.writestr("pessoas_2015-2021.csv", "NUNCA ABRIR")
            archive.writestr("veiculos_2015-2021.csv", "NUNCA ABRIR")
        return path

    def test_filters_pedestrian_events_and_preserves_only_allowed_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_zip(directory)
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                extractor.extract(path)
            raw = output.getvalue()
            self.assertNotIn("DADO PRIVADO", raw)
            self.assertNotIn("123456789", raw)
            items = [json.loads(line) for line in raw.splitlines()]
            self.assertEqual(len(items), 3)
            self.assertEqual(items[0]["date"], "2014-12-31")
            self.assertEqual(items[1]["date"], "2026-03-15")
            stats = items[-1]["stats"]
            self.assertEqual(stats["scanned"], 5)
            self.assertEqual(stats["relevant"], 4)
            self.assertEqual(stats["features"], 2)
            self.assertEqual(stats["withoutCoordinates"], 1)
            self.assertEqual(stats["outsideBounds"], 1)
            self.assertEqual(stats["municipalities"]["TABOAO DA SERRA"],
                             {"relevant": 4, "valid": 2, "missing": 1, "outside": 1})

    def test_rejects_schema_change(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.write_zip(directory, missing_field="latitude")
            with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(ValueError):
                extractor.extract(path)


if __name__ == "__main__":
    unittest.main()
