# Dados urbanos reais do SafeWalk

## O que está integrado

O backend consulta fontes públicas reais e entrega GeoJSON EPSG:4326, com coordenadas na ordem **longitude, latitude**. O desenho do mapa pode continuar fiel ao protótipo: as camadas são dados sobrepostos, não imagens fictícias. Os polígonos de calçadas e inundação são preservados. Sua presença não demonstra que uma rota seja segura ou acessível agora.

| Fonte/camada                            | Informação disponível                                                                      | Limite de interpretação                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| GeoSampa `calcada`                      | Polígonos, larguras mínima/média/máxima em metros, declividade em porcentagem              | Sem data de vistoria ou estado atual do piso; sem garantia de passagem livre, rampas ou piso tátil            |
| GeoSampa `iluminacao_publica`           | Pontos, tipo de luminária e data de carga do cadastro                                      | Não confirma luz acesa nem funcionamento                                                                      |
| GeoSampa `semaforo`                     | Pontos CET e tipo cadastrado                                                               | Não confirma sinal sonoro, travessia acessível, tempo ou funcionamento                                        |
| OpenStreetMap `highway=traffic_signals` | Semáforos mapeados por voluntários em 13 municípios vizinhos (importação local)            | Cadastro colaborativo e incompleto; não confirma funcionamento, sinal sonoro nem travessia acessível          |
| GeoSampa `risco_ocorrencia_alagamento`  | Ocorrências históricas SIGRC, data do evento                                               | Não representa alagamento ativo                                                                               |
| GeoSampa `mancha_inundacao_5`           | Polígonos de modelo, profundidade e período de retorno de 5 anos                           | Não é água observada, previsão imediata ou probabilidade de inundação hoje                                    |
| GeoSampa `acessibilidade_smped`         | Estabelecimentos com selo e ano cadastrado                                                 | Não certifica o caminho nem parceria ou acolhimento SafeWalk                                                  |
| GeoSampa `equipamento_saude_hospital`   | Equipamentos de saúde, inclusive especializados/ambulatórios                               | Emergência, horário e acolhimento não verificados; não implica parceiro SafeWalk                              |
| SP156                                   | Solicitações públicas trimestrais de manutenção e infraestrutura com coordenadas originais | Histórico de solicitações; protocolo `Finalizada` não comprova reparo                                         |
| CGE                                     | Contagem municipal da data, ativa/inativa, transitável/intransitável                       | Classificação veicular, sem geometria verificada no integrador; nenhum ponto inventado                        |
| Open-Meteo                              | Precipitação/chuva modeladas, código meteorológico e intervalo                             | Chuva não confirma alagamento; milímetros são acumulados no intervalo informado, não necessariamente por hora |

Smart Sampa, acesso a câmeras, atendimento GCM, envio oficial ao SP156, piso ruim em tempo real, pontos parceiros verificados e avaliação completa de segurança não são fornecidos por estas integrações. Não há promessa de cobertura integral da cidade nem escore de segurança derivado da ausência de registros.

## Fontes, acesso e atribuição

- [GeoSampa e créditos/licença](https://novogeosampa.prefeitura.sp.gov.br/). A licença CC BY-SA indicada pelo portal aplica-se às camadas produzidas pelos órgãos municipais; os metadados de cada camada continuam sendo referência. A atribuição ao município/órgão produtor acompanha os resultados.
- [WFS público GeoSampa](https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs?service=WFS&version=2.0.0&request=GetCapabilities). O catálogo informa CRS nativo EPSG:31983. A consulta de feições utiliza WFS 1.0.0 e solicita explicitamente EPSG:4326, testado com amostras reais no piloto. Foram identificadas 485 camadas; somente as sete pertinentes acima estão habilitadas.
- [Catálogo SP156](https://dados.prefeitura.sp.gov.br/dataset/dados-do-sp156), [API CKAN do recurso](https://dados.prefeitura.sp.gov.br/api/3/action/package_show?id=dados-do-sp156). O catálogo declara CCZero. Recursos trimestrais são CSV, não uma API de ocorrências ao vivo. O glossário do próprio catálogo diferencia encerramento de protocolo e execução do serviço.
- [CGE alagamentos](https://www.cgesp.org/v3/alagamentos.jsp), [classificação oficial](https://www4.cgesp.org/v3/alagamentos-classificacao.jsp), [robots.txt](https://www.cgesp.org/robots.txt). `/v3/` estava permitido em 28/10/2026. Parser conservador, cache de dois minutos, corpo limitado e falha explícita se o HTML mudar. Não há licença de redistribuição específica identificada na página; o integrador apresenta resumo atribuído e link oficial, não republica o site.
- [Open-Meteo documentação](https://open-meteo.com/en/docs), [termos](https://open-meteo.com/en/terms). Dados CC BY 4.0 com atribuição. O endpoint gratuito é para uso não comercial e sujeito aos limites do provedor; uma operação comercial deve usar serviço/plano compatível. Não foram inventadas credenciais ou cadastros.

## Contrato e atualização

`GET /api/urban/layers?bbox=west,south,east,north&types=sidewalks,lighting,...` e `GET /api/urban/sources` exigem autenticação. A consulta de camadas exige também o consentimento de serviços do mapa registrado no servidor; fontes podem ser consultadas antes de autorizar. Respostas HTTP usam `no-store` e variam por autorização. Tipos: `sidewalks`, `lighting`, `crossings`, `flood_history`, `flood_risk`, `accessibility`, `health`, `sp156`, `floods`, `weather`. Padrão: área pública piloto Bela Vista/entorno, `[-46.665,-23.575,-46.635,-23.545]`.

A resposta contém `features`, `sources`, `bbox`, `truncated`, `coverageWarnings`, `weather` e `floodSummary`. Cada fonte informa:

- `available`: consulta/importação válida dentro do prazo do cache; não significa condição urbana atual verificada;
- `stale`: cache vencido, fonte falhou ao atualizar ou resumo CGE de outra data;
- `unavailable`: não há leitura válida disponível; zero feições nessa situação não significa zero riscos;
- `not_configured`: SP156 ainda não importado neste ambiente;
- `fetchedAt`: horário UTC em que consultamos/importamos; `asOf`: referência temporal quando fornecida; `expiresAt`: validade operacional do cache;
- `coverage`, `featureCount`, `sourceUrl`, atribuição, licença e mensagem explicativa;
- `confidence: not_assessed`: não foi calculada confiança na condição atual nem segurança/acessibilidade do trajeto.

`observedAt` é nulo quando a fonte não informa data do evento/modelo. Data de carga de iluminação e semáforos fica separada em `details.sourceLoadAt`; não é tratada como vistoria. `sourceSurveyDate` permanece nulo quando desconhecido. O ano do selo SMPED não é convertido artificialmente em um dia de vistoria.

O cache MariaDB persistente (`urban_provider_cache`) usa fonte + bbox arredondado a uma grade de 0,005 grau. Chamadas idênticas simultâneas são agrupadas; cada host atende uma consulta por vez. Consultas WFS usam no máximo três páginas de até 150 candidatas, ordenadas por identificador estável, retendo até 300 feições por camada. A terceira página pede somente o necessário para repor candidatas excluídas por estarem fora do bbox WGS84. Candidatas próximas externas são filtradas sem invalidar as internas; CRS/eixos incompatíveis continuam sendo erro explícito. Quantidade de candidatas da origem, exclusões e cobertura parcial aparecem na proveniência. Limites: consultas ao vivo com bbox de até 0,08 grau por dimensão (visão da cidade até 1,2 grau, somente com importações), região operacional de São Paulo, até 4.000 feições agregadas (16.000 na visão da cidade), 1.000 SP156 por resposta, 30 requisições autenticadas/minuto por usuário. A interface deve consultar após o movimento terminar, com debounce e zoom mínimo, evitando pedidos a cada quadro.

TTL: calçadas/semáforos/mancha/SMPED 7 dias; iluminação/histórico/saúde 1 dia; CGE 2 minutos; Open-Meteo 10 minutos; importação SP156 90 dias. São prazos de reconsulta, sem transformar registros históricos em informação atual. Em falha externa, a leitura anterior é preservada como vencida e novas tentativas esperam cinco minutos. Há timeout de oito segundos por HTTP, uma repetição breve para 429/5xx, limite de corpo e allowlist HTTPS; redirecionamentos e URLs arbitrárias são recusados. Falha do banco não é substituída por dados em memória.

O contexto de rotas usa `getCachedUrbanContext(bbox)` e não dispara chamadas externas. Sua cobertura é sempre declarada parcial. As fontes não alteram o rótulo da rota para segura/acessível nem demonstram que um obstáculo cadastral está ativo.

## Camadas da cidade inteira (semáforos e histórico de alagamento)

Para o mapa mostrar semáforos e onde já alagou com a cidade inteira na tela, essas camadas de pontos são importadas localmente, uma vez, em vez de consultadas por área:

```powershell
npm run db:migrate
npm run build -w @safewalk/contracts
npm run import:city-layers -w @safewalk/api
```

- **Capital:** camada `semaforo` inteira da GeoSampa, em páginas de 1.000 (6.432 cadastrados em 07/11/2026; 6.419 com coordenadas). Fonte `geosampa-crossings`, substitui a consulta paginada de até 300 por área enquanto houver importação.
- **Alagamentos já registrados:** camada `risco_ocorrencia_alagamento` inteira (SIGRC/Defesa Civil; 292 ocorrências em 07/11/2026). Fonte `geosampa-flood-history`. Histórico, não alerta atual.
- **Delegacias e hospitais:** camadas `equipamento_policia_civil` (93 delegacias, inclusive Delegacias de Defesa da Mulher; fonte `geosampa-police`, tipo `police`) e `equipamento_saude_hospital` (98 hospitais; fonte `geosampa-health`). Nas cidades vizinhas, `amenity=police` (`osm-police`) e `amenity=hospital` (`osm-hospitals`) do OpenStreetMap, na mesma consulta Overpass dos semáforos (prédios usam o centro). Horário, plantão, pronto-socorro e atendimento não são verificados.
- **Áreas que podem alagar:** a mancha modelada (`mancha_inundacao_5`) tem cerca de 30 mil polígonos e não é importada; continua consultada por área ao aproximar o mapa.
- **Vizinhas:** OpenStreetMap via Overpass (`overpass-api.de`), uma consulta por município, com pausas: Taboão da Serra, Embu das Artes, Itapecerica da Serra, Cotia, Osasco, Carapicuíba, Barueri, Guarulhos, Santo André, São Bernardo do Campo, São Caetano do Sul, Diadema e Mauá. Fonte `osm-signals`, licença ODbL, atribuição “© colaboradores do OpenStreetMap”. Sem importação, a fonte aparece como `not_configured`.
- Opções: `-- --skip-osm` ou `-- --skip-geosampa`. Cada lote substitui o anterior atomicamente; falha mantém o último válido. Prazo operacional de 90 dias.

`/api/urban/layers` aceita bbox de até **1,2 grau** na região de São Paulo. Acima de 0,08 grau (“visão da cidade”) a API responde somente com fontes importadas (semáforos, histórico de alagamento, SP156, InfoSiga) e com os resumos CGE/Open-Meteo, sem chamar provedores ao vivo; as demais camadas voltam ao aproximar o mapa e `coverageWarnings` informa quais ficaram de fora. A área larga é arredondada para uma grade de 0,05 grau, até 9.000 semáforos por fonte e 16.000 feições por resposta. As respostas da API são comprimidas (gzip).

## Importação SP156 local

O CSV do 3º trimestre de 2026 foi validado: recurso `f67fcc12-8da4-485f-92a3-d2af40cc771e`, publicação de 13/10/2026. Arquivo real com aproximadamente 105,6 MB e 484.232 linhas. O formato de data desse recurso é `MM/DD/YYYY`, confirmado por datas sem ambiguidade como `07/25/2026`.

Baixe o recurso oficial e execute na raiz do repositório, depois de aplicar migrações e compilar contratos:

```powershell
npm run db:migrate
npm run build -w @safewalk/contracts
npx tsx apps/api/src/modules/urban-data/import-sp156.ts --file work/sp156-sample.csv --resource-id f67fcc12-8da4-485f-92a3-d2af40cc771e
npx tsx apps/api/src/modules/urban-data/refresh-pilot.ts --output work/urban-validation.json
```

Para ampliar a importação além do piloto, use a opção administrativa `--city`:

```powershell
npx tsx apps/api/src/modules/urban-data/import-sp156.ts --file work/sp156-sample.csv --resource-id f67fcc12-8da4-485f-92a3-d2af40cc771e --city
```

Essa opção considera a faixa `[-46.85,-24.05,-46.35,-23.35]`, ampla o suficiente para a área operacional da capital. Ela é um retângulo, não o polígono oficial do município. A origem é o SP156 **da Prefeitura de São Paulo**; não representa os serviços municipais de Taboão da Serra ou de outras cidades. Os registros com coordenadas fora do município precisam ser interpretados conforme a origem, sem afirmar que sejam chamados dos municípios vizinhos.

O importador confirma o identificador/URL no catálogo oficial, processa o arquivo em streaming (máximo 150 MB), filtra serviços pertinentes e a área escolhida e armazena só campos necessários. Sem `--city`, usa a área piloto ou o `--bbox` administrativo limitado. Não importa identidade de denunciante, contato, texto livre ou fotografia; não geocodifica endereços ausentes. Coordenadas faltantes/zero são contadas e excluídas do mapa. Campos desconhecidos não são propagados. O recurso publicado não fornece número de protocolo: um hash de campos públicos normalizados e identificador do recurso evita duplicatas exatas, sem alegar contagem exata de eventos distintos.

O lote é substituído atomicamente após parsing e validação bem-sucedidos. Falhas mantêm o lote anterior. O importador limita cada lote a 100.000 feições e aborta a substituição se alcançar esse teto. O identificador externo das feições permanece estável em reimportações do mesmo recurso. No lote validado, 82.600 linhas eram pertinentes; 17.848 dessas não tinham coordenadas utilizáveis em toda a base. A área piloto reteve **1.255 solicitações públicas deduplicadas**; a importação ampliada de outubro de 2026 reteve **61.746**. Ela cobre apenas as categorias selecionadas, com coordenadas originais, do arquivo trimestral importado; não representa todos os chamados ou todos os trimestres. A resposta limita-se a 1.000 e marca `truncated`; o mapa limita os pontos mostrados e pode ser aproximado para consultar menos por vez. O relatório separa contagem do arquivo inteiro e contagem geográfica importada. Em uma leitura local, o processo alcançou cerca de 269 MB de memória; dimensione recursos e banco antes de rodar em hospedagem.

Para novo trimestre, obtenha o novo identificador no catálogo e repita o processo. CSV não é baixado durante o movimento do mapa. O importador atual reconhece os cabeçalhos/datas validados; mudança de formato interrompe a importação para revisão. Não existe endpoint público de mutação/importação.

## Operação e testes

As telas `/dados-urbanos`, `/dado-urbano/[id]` e `/dados-rota` usam os mesmos contratos. A lista aceita `bbox` da área visível do mapa, valida os limites e preserva essa área ao abrir um detalhe; sem área válida usa o piloto e avisa. São 30 registros por página. O detalhe mostra campos reais/unidades, datas civis sem deslocamento para a véspera e, quando disponível e autorizado, a geometria original. CGE permanece resumo sem pontos. O contexto da rota preserva até 100 registros da consulta (20 por página), com suas fontes e lacunas, sem criar geometria ausente ou concluir passagem segura. Nenhuma dessas telas solicita GPS.

O cache é atualizado sob demanda. `refresh-pilot.ts` pode ser executado pelo agendador do ambiente para aquecer a área pública piloto; apenas fontes com TTL vencido são consultadas. Por exemplo, uma execução a cada dois minutos mantém o resumo CGE dentro de seu prazo quando a origem está disponível. Não foi criado agendamento nem feita alteração na ValueHost. Antes de ampliar a área, estabeleça retenção/monitoramento do volume de tiles do banco, condições de uso e capacidade dos provedores.

As consultas de chuva utilizam centro arredondado a duas casas decimais, nunca uma fixação GPS precisa. Os testes externos e a importação usaram somente coordenadas de vias públicas do piloto. Nenhuma localização pessoal foi enviada às novas fontes.

```powershell
npx tsx --test apps/api/src/integrations/urban/urban.test.ts
npx tsx --test apps/api/test/urban.integration.test.ts
npm run typecheck -w @safewalk/api
```

Testes verificam validação geográfica/SSRF, distinção histórico/modelo/ativo, preservação de polígonos/unidades, falha de parser CGE, CSV com aspas e linhas internas, ausência de identidade, coordenadas originais, deduplicação e preservação do cache em falhas. O teste de leitura real SP156 é ignorado quando não existe importação local. A amostra executada fica em `work/urban-validation.json`, com proveniência, prazos, limites, contagens e uma feição pública de exemplo por fonte geográfica.

Na QA do bbox público `[-46.655,-23.57,-46.645,-23.55]`, o WFS retornou 942 candidatas. Dez polígonos das primeiras páginas ficaram poucos metros fora dos limites WGS84; eles são descartados, preservando os demais. Uma terceira página de dez candidatas completou 300 calçadas válidas. O resultado continua parcial e sem avaliação da condição atual. A recuperação foi conferida pelo serviço e por HTTP autenticado com consentimento, ambos com 300 feições e fonte `available`; evidências em `work/urban-bbox-diagnostic.json`, `work/urban-bbox-recovery.json` e `work/urban-bbox-http.json`. Somente a entrada negativa exata desse bbox foi liberada para nova tentativa; nenhuma outra cópia armazenada foi alterada.

## Importação da SSP-SP (leitura de registros das rotas)

Baixe as planilhas "Dados criminais" em <https://www.ssp.sp.gov.br/estatistica/consultas> e informe cada arquivo (nunca versione as planilhas):

```bash
npm run import:ssp-crimes -w @safewalk/api -- --file /caminho/SPDadosCriminais_2025.xlsx --file /caminho/SPDadosCriminais_2026.xlsx
```

O extrator lê a planilha em fluxo e grava em `crime_points` só categoria, data, período do dia e coordenada, dentro da área de serviço. Número de BO, delegacia, nome, endereço e bairro não saem do processo; a deduplicação usa um hash de sentido único. Entram apenas roubo e furto "outros" (sem veículo, carga, fios, residência ou estabelecimento), lesão dolosa, tentativa de homicídio, homicídio doloso, latrocínio e estupro, sempre em via pública. Nos arquivos de 2025 e 2026 importados, nenhuma ocorrência de estupro chegou com coordenada dentro da área de serviço; a categoria continua prevista, mas esses crimes não entram na conta enquanto a SSP não publicar o local, e a leitura avisa isso. Coordenadas exatas com mais de 40 boletins são descartadas por indicarem endereço genérico. A troca do lote é atômica; se a importação falhar, o lote anterior continua. Depois de 120 dias a leitura informa que os dados estão desatualizados. Esta fonte não é exibida como camada do mapa: pontos individuais de crime não vão para o aplicativo.
