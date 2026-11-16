# InfoSiga: registros históricos envolvendo pedestres

O InfoSiga, do Detran-SP, é uma fonte estadual e contempla também municípios fora da capital. A camada `pedestrian_crashes` é opcional e precisa ser ativada em **Camadas do mapa**. Suas consultas leem o lote importado no banco local, sem enviar a área do mapa ao InfoSiga a cada movimento.

O lote considera arquivos públicos nomeados de 2015 a 2026, filtrados por envolvimento de pedestre; o primeiro também contém seis registros de 2014. O período efetivamente disponível varia por município. A importação e os registros sem coordenadas são apresentados na proveniência. Coordenadas são as informadas pela fonte, mas sua precisão é desconhecida: não comprovam o local exato. Notificações não confirmam sinistro. Um sinistro fatal envolvendo pedestre não comprova que a vítima fatal era pedestre. Nenhum desses registros comprova risco atual ou condição segura; ausência de pontos não significa ausência de ocorrências.

Embora o arquivo importado tenha abrangência estadual, o aplicativo atualmente só consulta a faixa operacional da região de São Paulo, dentro de `[-46.85,-24.05,-46.35,-23.35]`, em áreas de até 0,08 grau por dimensão. Isso inclui partes da região metropolitana, mas não disponibiliza imediatamente todo o estado para consulta no mapa.

Os arquivos de pessoas e veículos não são lidos pelo importador. A interface apresenta somente dados públicos de sinistro selecionados, sem identidade de vítimas. Registros sem coordenadas são contados e não recebem ponto inventado. Cada consulta por área retorna até 1.000 feições e informa truncamento; o mapa divide o limite de exibição entre as camadas selecionadas.

O InfoSiga não é usado para classificar a rota nem para identificar ocorrências a 50 metros da rota, porque a precisão das coordenadas é desconhecida. O mecanismo de rotas permanece com segurança e acessibilidade não avaliadas.

Fonte: [InfoSiga / Detran-SP](https://infosiga.detran.sp.gov.br/). A reutilização está indicada como CC BY 4.0 no catálogo estadual. O carregamento e a atualização do arquivo exigem operação administrativa; não é feed em tempo real.

## Importação administrativa local

Após aplicar as migrações e compilar os contratos, obtenha o ZIP público no [painel oficial](https://infosiga.detran.sp.gov.br/painel/download/file/dados_infosiga.zip). A leitura requer Python 3 no host. Primeiro execute sem `--commit` para validar o arquivo; depois, para atualizar o lote local, acrescente `--commit`:

```powershell
npx tsx apps/api/src/modules/urban-data/import-infosiga.ts --file work/infosiga-publico.zip --summary work/infosiga-dryrun-summary.json
npx tsx apps/api/src/modules/urban-data/import-infosiga.ts --file work/infosiga-publico.zip --commit --summary work/infosiga-summary.json
```

O relatório contém totais agregados por município. A substituição do lote é atômica e mantém o lote anterior em caso de falha. O serviço de mapa usa apenas o resultado importado; uma consulta não aciona o download do ZIP.
