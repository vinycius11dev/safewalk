# Infosiga: importação histórica de sinistros com pedestres

O importador lê o ZIP público do [Infosiga / Detran-SP](https://infosiga.detran.sp.gov.br/painel/download/file/dados_infosiga.zip), com atribuição Detran-SP e licença CC BY 4.0. Apenas `sinistros_2015-2021.csv`, `sinistros_2022-2024.csv` e `sinistros_2025-2026.csv` são abertos; os arquivos de pessoas e veículos presentes no ZIP nunca são lidos ou extraídos. O ZIP bruto pode conter informações que o aplicativo não precisa e deve permanecer em uma pasta de trabalho privada, fora de qualquer diretório público.

Cada arquivo é processado em streaming com Python 3 e sua biblioteca padrão (`zipfile` e `csv`, codificação Windows-1252); Node e `mysql2` gravam em lotes de até 200. Apenas eventos que indicam `qtd_pedestre > 0` ou `tp_sinistro_atrop_pedestre = S` entram na seleção. Uma notificação não é confirmação de sinistro e uma classificação fatal do evento não indica qual participante faleceu. São guardados somente um hash do identificador do evento, data civil, tipo de registro, município e coordenadas fornecidas na fonte. Nome, endereço, horário, vítimas, placas e informações individuais de veículos não são armazenados.

Coordenadas ausentes, inválidas ou fora do envelope estadual aproximado `[-53.3,-25.4,-44.0,-19.7]` são descartadas. O envelope não equivale a um polígono de limites municipais ou estaduais. A localização vem da base e sua precisão é desconhecida; não há promessa de ponto exato. O ISO da data usa meia-noite UTC apenas para preservar o dia, com `datePrecision=calendar_date`, sem afirmar horário do evento.

O arquivo denominado 2015–2021 contém seis registros relevantes de 2014, preservados na data fornecida. No lote consultado em outubro de 2026, a cobertura temporal observada é 2014–2026. Dados históricos não comprovam risco atual ou condição segura do percurso.

## Uso local

Após baixar o ZIP oficial para `work/infosiga-publico.zip`, instalar dependências e aplicar `npm run db:migrate -w @safewalk/api`:

```powershell
npx tsx apps/api/src/modules/urban-data/import-infosiga.ts --file work/infosiga-publico.zip --summary work/infosiga-dryrun-summary.json
npx tsx apps/api/src/modules/urban-data/import-infosiga.ts --file work/infosiga-publico.zip --commit --summary work/infosiga-summary.json
```

Sem `--commit`, a rotina valida e contabiliza os registros sem alterar o banco. O JSON de resumo contém totais, percentual de coordenadas aproveitáveis e contagens por município, sem registros individuais. `INFOSIGA_PYTHON` pode indicar o executável Python; o padrão é `python` no Windows e `python3` nos demais sistemas. A execução compilada exige Python no host. `npm run build -w @safewalk/api` copia o extrator para `dist/integrations/urban` junto ao CLI; essa cópia é necessária no pacote que executar a rotina.

O lote e as contagens municipais são gravados na mesma transação. Um bloqueio impede importações simultâneas, o arquivo é verificado por SHA-256 antes e após a leitura e a substituição remove somente lotes anteriores de `source_id=infosiga`. Erros, arquivo truncado, esquema desconhecido ou duplicação causam rollback e preservam o lote anterior e os dados do SP156. Os dados não são removidos por uma tarefa automática: o prazo de 90 dias apenas indica quando a fonte passa a ser considerada desatualizada. Um novo lote válido substitui o anterior.

A rotina exige exatamente os três nomes e períodos conhecidos, salvo os seis registros de 2014. Se o formato ou a divisão de arquivos mudar, ela falha de forma segura e precisa ser adaptada antes da próxima importação. Não há atualização automática configurada.
