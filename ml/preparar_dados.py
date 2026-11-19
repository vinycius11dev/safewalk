"""Extrai do ZIP público do Infosiga (Detran-SP) os sinistros com pedestre
na capital paulista e grava um CSV enxuto em dados/processed/.

Uso:
    python preparar_dados.py dados/raw/dados_infosiga.zip

Somente os arquivos sinistros_*.csv são lidos; pessoas_* e veiculos_* nunca
são abertos. Nenhum dado pessoal (nome, placa, idade) é gravado.
"""
from __future__ import annotations

import io
import sys
import zipfile
from pathlib import Path

import pandas as pd

COD_IBGE_SAO_PAULO = 3550308
ANO_INICIAL = 2019  # Infosiga só registra sinistros não fatais a partir de 2019
REGISTROS_VALIDOS = {"SINISTRO FATAL", "SINISTRO NAO FATAL"}

COLUNAS = [
    "id_sinistro", "tipo_registro", "data_sinistro", "ano_sinistro", "mes_sinistro",
    "dia_sinistro", "hora_sinistro", "dia_da_semana", "turno", "tipo_via", "tipo_local",
    "latitude", "longitude", "cod_ibge", "municipio", "administracao", "conservacao",
    "circunscricao", "tp_sinistro_primario", "qtd_pedestre", "qtd_bicicleta",
    "qtd_motocicleta", "qtd_automovel", "qtd_onibus", "qtd_caminhao", "qtd_veic_outros",
    "qtd_gravidade_fatal", "qtd_gravidade_grave", "qtd_gravidade_leve",
    "qtd_gravidade_ileso", "qtd_gravidade_nao_disponivel", "tp_sinistro_atropelamento",
]


def ler_sinistros(zip_path: Path) -> pd.DataFrame:
    partes = []
    with zipfile.ZipFile(zip_path) as zf:
        nomes = sorted(n for n in zf.namelist() if Path(n).name.startswith("sinistros_") and n.endswith(".csv"))
        if not nomes:
            raise SystemExit("Nenhum sinistros_*.csv no ZIP. O formato do Infosiga mudou?")
        for nome in nomes:
            print(f"lendo {nome} ...", flush=True)
            with zf.open(nome) as fh:
                for chunk in pd.read_csv(
                    io.TextIOWrapper(fh, encoding="latin-1"), sep=";", dtype=str,
                    usecols=lambda c: c in COLUNAS, chunksize=200_000,
                ):
                    chunk = chunk[pd.to_numeric(chunk["cod_ibge"], errors="coerce") == COD_IBGE_SAO_PAULO]
                    chunk = chunk[chunk["tipo_registro"].isin(REGISTROS_VALIDOS)]
                    ped = pd.to_numeric(chunk["qtd_pedestre"], errors="coerce").fillna(0) > 0
                    atrop = chunk.get("tp_sinistro_atropelamento", pd.Series("", index=chunk.index)).eq("S")
                    atrop |= chunk["tp_sinistro_primario"].eq("ATROPELAMENTO")
                    partes.append(chunk[ped | atrop])
    df = pd.concat(partes, ignore_index=True)
    df["ano_sinistro"] = pd.to_numeric(df["ano_sinistro"], errors="coerce")
    df = df[df["ano_sinistro"] >= ANO_INICIAL]
    return df.drop_duplicates("id_sinistro")


def main() -> None:
    zip_path = Path(sys.argv[1] if len(sys.argv) > 1 else "dados/raw/dados_infosiga.zip")
    destino = Path(__file__).parent / "dados" / "processed" / "atropelamentos_sp_capital.csv"
    df = ler_sinistros(zip_path)
    destino.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(destino, index=False, encoding="utf-8")
    print(f"{len(df):,} sinistros com pedestre gravados em {destino}")
    print(df.groupby(["ano_sinistro", "tipo_registro"]).size().unstack(fill_value=0))


if __name__ == "__main__":
    main()
