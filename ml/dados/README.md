# Dados usados na entrega de ML

## Fonte

| Campo            | Valor                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Base             | **Infosiga SP** — Sistema de Informações Gerenciais de Sinistros de Trânsito      |
| Responsável      | Detran-SP (Governo do Estado de São Paulo)                                        |
| Página           | https://infosiga.detran.sp.gov.br/                                                |
| Download         | https://infosiga.detran.sp.gov.br/painel/download/file/dados_infosiga.zip         |
| Licença          | Creative Commons Atribuição 4.0 (CC BY 4.0), conforme catálogo estadual           |
| Arquivos lidos   | somente `sinistros_*.csv` (`pessoas_*` e `veiculos_*` nunca são abertos)          |
| Formato          | CSV `;`, codificação Windows-1252, decimal com vírgula nas coordenadas            |
| Período usado    | 2019 em diante (o Infosiga só registra sinistros **não fatais** a partir de 2019) |
| Data do download | ver `figuras/resumo_execucao.json` (campo `periodo`)                              |

Os mesmos registros alimentam a camada **“Sinistros com pedestre”** do mapa do SafeWalk (`docs/infosiga.md`).

## Recorte aplicado (`preparar_dados.py`)

1. Município de São Paulo (`cod_ibge = 3550308`).
2. `tipo_registro` = `SINISTRO FATAL` ou `SINISTRO NAO FATAL`. Registros `NOTIFICACAO` são descartados porque não têm gravidade apurada.
3. Sinistro com pedestre: `qtd_pedestre > 0` **ou** `tp_sinistro_atropelamento = S` **ou** `tp_sinistro_primario = ATROPELAMENTO`.
4. `ano_sinistro >= 2019`; duplicatas de `id_sinistro` removidas.

Resultado: `processed/atropelamentos_sp_capital.csv` (UTF-8), um sinistro por linha (31.139 linhas no download de 19/11/2026).

## Filtros aplicados no notebook

5. Removidos 551 sinistros sem nenhuma gravidade apurada.
6. Mantidos só **registros completos** (29.410, 96,1%): hora presente, coordenada dentro da capital, `tipo_via` e `circunscricao` preenchidos. Campos vazios são típicos do fluxo de registro de óbitos (hora ausente = 100% fatal) e vazariam o alvo.

## Como reproduzir

```bash
cd ml
pip install -r requirements.txt
mkdir -p dados/raw
curl -L -o dados/raw/dados_infosiga.zip https://infosiga.detran.sp.gov.br/painel/download/file/dados_infosiga.zip
python preparar_dados.py dados/raw/dados_infosiga.zip
jupyter nbconvert --to notebook --execute --inplace safewalk_ml.ipynb
```

`dados/raw/` está no `.gitignore` (o ZIP oficial é grande e contém arquivos que o projeto não usa). O CSV processado é versionado para o notebook rodar sem o download.

## Dicionário das colunas usadas

| Coluna                                                                            | Uso no modelo                                                                                              |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `qtd_gravidade_fatal`, `qtd_gravidade_grave`                                      | **alvo** (`grave_ou_fatal = 1` se a soma > 0); não entram como variável                                    |
| `qtd_gravidade_leve`, `qtd_gravidade_ileso`                                       | só para descartar sinistros sem nenhuma gravidade apurada                                                  |
| `hora_sinistro`                                                                   | hora inteira (0–23) e indicador `noite` (19h–5h)                                                           |
| `dia_da_semana`                                                                   | categórica + indicador `fim_de_semana`                                                                     |
| `mes_sinistro`                                                                    | mês (sazonalidade)                                                                                         |
| `tipo_via`, `circunscricao`                                                       | categóricas (one-hot)                                                                                      |
| `latitude`, `longitude`                                                           | numéricas; registros fora da capital são descartados                                                       |
| `qtd_bicicleta`, `qtd_motocicleta`, `qtd_automovel`, `qtd_onibus`, `qtd_caminhao` | contagens de envolvidos + indicador `veic_pesado`                                                          |
| `tipo_registro`, `tp_sinistro_primario`, `id_sinistro`                            | **excluídas** (vazamento direto do alvo ou identificador)                                                  |
| `qtd_veic_outros`, `tipo_local`, `qtd_pedestre`                                   | **excluídas**: preenchidas de forma diferente para fatais e não fatais (vazamento pelo registro)           |
| `administracao`, `conservacao`                                                    | **excluídas**: nome do órgão/concessionária, específico demais e redundante com `tipo_via`/`circunscricao` |

## Limites conhecidos

- Precisão das coordenadas não informada pela fonte.
- Não há dado de exposição (quantos pedestres passam em cada via/hora), então o modelo estima **gravidade dado que houve sinistro**, não probabilidade de sofrer um sinistro.
- Casos leves tendem a ser sub-registrados, o que eleva a proporção de graves.
- Nenhum dado pessoal (nome, idade, placa, endereço de vítima) é usado.
