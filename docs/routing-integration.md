# Busca e rotas reais a pé e de carro

O servidor integra Photon para endereços e Valhalla para trajetos `pedestrian` ou `auto` com dados do OpenStreetMap. Cada cálculo usa um perfil por vez; não mistura regras de pedestres e veículos. Não desenha uma linha fictícia quando o serviço falha e não chama um percurso de seguro ou acessível sem evidência suficiente. As alternativas só aparecem quando o próprio motor as retorna.

## Endpoints

Exigem sessão e consentimento explícito `public-maps-v1`, gerenciado em `/api/maps/consent`. O consentimento é necessário porque a consulta e as coordenadas são transmitidas aos serviços externos, que podem manter registros conforme as próprias políticas.

- `GET /api/geocoding/search?q=Shopping%20Frei%20Caneca&bbox=-46.75,-23.65,-46.55,-23.45`: até oito endereços. `bbox` opcional segue oeste,sul,leste,norte.
- `GET /api/geocoding/reverse?lat=-23.5641&lon=-46.6521`: endereço próximo do ponto, com limite de 250 metros de busca.
- `POST /api/routing/routes`: corpo `{origin:{latitude,longitude},destination:{latitude,longitude},destinationLabel?,profile:"pedestrian"|"auto",preference?}`. Resposta `status:"available"`, opções com GeoJSON, instruções, distância, duração, fonte e validade. `preference` aceita `standard` (padrão), `prefer_lit` e `step_free`, ajustando o `costing_options` do Valhalla por etiquetas do OpenStreetMap; essas preferências valem para pedestres. Quando a preferência é `prefer_lit`, o servidor faz uma consulta adicional ao Valhalla sem critérios e anexa ao fim da lista as alternativas novas — as opções da preferência escolhida vêm primeiro e cada rota declara `preference` na resposta. A consulta extra usa o mesmo cache de cinco minutos e uma falha dela não impede as opções preferidas.
- `POST /api/trips`: recebe `routeId` da opção calculada. O servidor verifica dono e validade, copia o percurso completo para o trajeto e calcula a chegada usando segundos reais. O corpo não pode substituir a geometria. O acompanhamento público recebe esse mesmo snapshot.

A região operacional usa a caixa `[-47.3,-24.2,-45.9,-23.1]`. A distância direta aceita vai de 20 metros a 100 km a pé / 300 km de carro. Isso delimita consultas e consumo; não implica cobertura ou qualidade uniforme do cadastro.

A busca do aplicativo usa essa área inteira, enquanto as camadas urbanas continuam com cobertura própria e parcial. A consulta exata “FIAP Paulista” é resolvida pelo endereço institucional publicado pela [FIAP](https://www.fiap.com.br/institucional/), Avenida Paulista, 1106; o ponto aproximado vem de um resultado Photon para esse endereço. Se o provedor não retornar o número correto, não fabricamos um resultado. Outros nomes e endereços dependem da cobertura e da disponibilidade do Photon.

## Operação e privacidade

Cada origem de serviço tem fila limitada, intervalo mínimo de 1,1 segundo, timeout de 12 segundos, limite de resposta de 1,5 MB e pausa após falhas/limitação. URLs vêm exclusivamente da configuração do servidor, sem redirecionamentos. Por usuário são permitidas 20 consultas por minuto. Nenhuma URL com localização pessoal é escrita nos logs.

Cache de endereço: uma hora. Cache do cálculo externo: cinco minutos, preservando o instante original de cálculo. Opções pertencem ao usuário e expiram após 15 minutos; cache/opções expirados são removidos a cada dez minutos em lotes de 500. Exclusão da conta remove essas tabelas por chave estrangeira. O snapshot de um trajeto já iniciado permanece no histórico sujeito à política de retenção do histórico. O histórico de localização em andamento continua recebendo GPS real, separado do percurso planejado.

Os servidores comunitários são adequados para o protótipo com uso moderado, sem SLA. Em produção, por padrão exigimos instâncias próprias compatíveis ou autorização operacional explícita para usar os serviços comunitários:

```dotenv
GEOGRAPHIC_SERVICES_ENABLED=true
PHOTON_BASE_URL=https://photon.komoot.io
VALHALLA_BASE_URL=https://valhalla1.openstreetmap.de
# Somente se o operador avaliou as regras e a capacidade do serviço comunitário:
ALLOW_COMMUNITY_GEO_SERVICES=true
```

Não são necessárias chaves para esses dois endpoints. Base URLs aceitam apenas origem HTTPS sem credenciais/caminho; HTTP local é permitido apenas fora de produção para testes. Não existe integração silenciosa com MapTiler, GraphHopper ou OpenRouteService: novos provedores exigem adaptador, análise de termos, configuração e testes próprios.

## Fontes técnicas e limites

- [Photon e política do servidor de demonstração](https://github.com/komoot/photon): permite uso razoável, pode limitar ou bloquear solicitações excessivas, sem garantia de disponibilidade.
- [API Photon](https://github.com/komoot/photon/blob/master/docs/api-v1.md): busca, extensão geográfica e busca reversa.
- [Valhalla, API de rotas](https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/): perfis, unidades, instruções e alternativas. Usamos `pedestrian`, `kilometers` e idioma `pt-BR`.
- [Decodificação Valhalla](https://valhalla.github.io/valhalla/api/decoding/): precisão seis casas decimais. GeoJSON usa longitude antes de latitude.
- [Especificação oficial e servidor FOSSGIS](https://github.com/valhalla/valhalla/blob/master/docs/docs/api/openapi.yaml).
- [Direitos e atribuição OpenStreetMap](https://www.openstreetmap.org/copyright).

Uma rota pedestre não comprova piso em bom estado, largura, rebaixamento, iluminação, segurança pessoal nem ausência de alagamento. O contrato mantém `riskLabel:"desconhecido"`, `safety:"not_assessed"` e `accessibility:"not_assessed"`. Dados históricos e cadastros urbanos devem ser apresentados como contexto com fonte/data/cobertura; um registro ausente não comprova ausência de obstáculos. Não há orientação por voz; o acompanhamento do desvio e o recálculo automático durante o trajeto estão descritos abaixo.

O campo opcional `context` anexa até 100 registros próximos de uma faixa aproximada de 50 metros, usando somente dados já armazenados da visualização do mapa e da importação SP156. São preservados fonte, data, tipo e cobertura. A interseção considera pontos, linhas e polígonos com anéis internos; usa aproximação métrica local e tem limite de processamento. Não executa novas consultas externas, não considera o resumo municipal do CGE como ocorrência georreferenciada e não modifica o caminho do motor. Esse contexto é sempre parcial e também fica no snapshot do trajeto.

A revogação do consentimento bloqueia novas posições GPS de trajetos reais no servidor. A verificação e a inserção acontecem na mesma transação. O percurso planejado continua no histórico; revogar consentimento não equivale a apagar o histórico.

### Acompanhamento e recálculo após desvio

O app projeta cada posição GPS sobre os segmentos da geometria, mantém o progresso monotônico e exige três fixes com boa precisão por pelo menos 12 segundos antes de confirmar desvio. O botão manual de nova rota só aparece após falha do cálculo automático. `POST /api/trips/:id/reroute` recebe apenas o ID esperado da rota: a origem vem da última posição recebida no servidor; destino, perfil e preferência vêm do snapshot salvo. O servidor reserva uma tentativa por lock, impõe intervalo mínimo, calcula a alternativa fora da transação e troca snapshot/ETA em uma gravação transacional. Os contatos e links existentes são preservados. Se a posição estiver antiga/imprecisa, o serviço estiver indisponível ou a proposta falhar, a rota anterior continua ativa e o app permite nova tentativa.

### Relato rápido durante trajeto

O botão de bloqueio no acompanhamento usa GPS recente; o endereço reverso só é consultado após a pessoa abrir o formulário. O app pode mostrar uma pergunta quando se aproxima de um relato comunitário ainda sem voto. Cada usuário registra uma resposta por relato: “Ainda existe”, “Foi resolvido” ou “Não encontrei”. As consultas próximas usam células de aproximadamente 100 m e atualizam em intervalo limitado para não requisitar geocodificação/relatos a cada fix de GPS.

Relatos compartilhados são voluntários, anônimos para outros usuários e exibidos como não verificados. O ponto público é aproximado e o consentimento global do autor pode ocultar os relatos imediatamente. Fotos são JPEG/PNG, até 3 MB, limpas de EXIF e servidas apenas por endpoint autenticado. O envio não encaminha informação ao SP156.

## Validação

Fixtures reproduzem respostas públicas consultadas somente para locais públicos (FIAP Paulista e Shopping Frei Caneca). Os testes verificam geometria realista, eixos/precisão, instruções, alternativas, recusa de perfil automotivo, propriedade/validade das opções e snapshot persistido. Falhas externas são testadas sem gerar carga nos serviços. Uma consulta real de busca e uma de rota receberam HTTP 200 em 28/10/2026; isso comprova a integração naquele instante, não disponibilidade contínua.

A consulta `/routing/routes/:id/context?tripId?` devolve geometrias e clima do entorno do traçado, com autorização por proposta/trajeto, atualização limitada em segundo plano, estado de atualização e cobertura parcial. O perfil `step_free` mantém somente opções calculadas para essa preferência.

## Chuva e condições de inundação por rota

O clima Open-Meteo é associado à região consultada, não à observação de um pluviômetro na rua. O aplicativo classifica chuva somente com dados dentro da janela de validade; quando há chuva estimada, mostra o efeito visual no mapa e dá destaque às camadas conhecidas de inundação. A preferência de movimento reduzido desativa a animação.

Cada opção de rota pode incluir `context.floodAssessment`, e `GET /api/routing/routes/:id/context?tripId?` inclui `floodAssessment` da rota salva/selecionada. O objeto informa o perfil, estado do clima, dados ativos/históricos/modelados, situação da fonte, datas, cobertura parcial e recomendação. Durante chuva, quando há fontes de modelo atualizadas e comparáveis com exposições diferentes, a menor contagem conhecida pode ser marcada como `lower_known_exposure`; o aplicativo a apresenta primeiro apenas se a pessoa ainda não escolheu uma opção. A escolha explícita é mantida.

`avoid` exige ocorrência recente, georreferenciada e explicitamente intransitável para o perfil da rota. O CGE integrado neste projeto fornece apenas totais municipais sem coordenadas verificadas e por isso fica como `aggregate_only`: não confirma que um ponto esteja no percurso. Os registros GeoSampa/SIGRC são históricos e atualizados mensalmente. Nenhuma camada histórica, estimada ou ausência de registro comprova que a via esteja seca ou segura. A classificação de bloqueio veicular não é convertida em bloqueio de pedestres. O motor calcula rotas de carro e de pedestres separadamente; o perfil de carro segue restrições viárias do OpenStreetMap, mas não verifica trânsito ao vivo, rodízio por placa ou interdições recentes.

## Leitura de registros conhecidos

`POST /routing/routes` acrescenta `recordsReading` às rotas a pé. O cálculo fica em `apps/api/src/domain/route-records-score.ts` (`known_records_rules_v1`) e usa somente dados já importados, sem nova consulta externa. O percurso é dividido em trechos de pelo menos 200 m; cada registro entra uma vez, no trecho mais próximo.

| Dado                                                                | Faixa    | Peso base                                                                                | Ajustes                                                                                                         |
| ------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Roubo, furto, violência física e crime sexual (SSP-SP, via pública) | 100 m    | 1 / 0,5 / 0,8 / 1,2                                                                      | mesmo período do dia ×1; vizinho ×0,5; oposto ×0,25; sem período ×0,4. Até 6 meses ×1; até 12 ×0,8; até 24 ×0,5 |
| Atropelamento (Infosiga)                                            | 100 m    | fatal 1; com vítima 0,6; notificação 0,25                                                | até 12 meses ×1; até 36 ×0,6; até 60 ×0,3; depois não conta                                                     |
| Relato comunitário ativo                                            | 150 m    | 0,5 + 0,25 por confirmação − 0,25 por "não encontrado" ou "resolvido", limite 1,5        | a coordenada pública é arredondada                                                                              |
| Chamado SP156                                                       | 50 m     | 0,1                                                                                      | no máximo 0,5 por trecho                                                                                        |
| Alagamento                                                          | percurso | 3 por ocorrência ativa; +2 se intransitável; 0,5 por área conhecida durante chuva, até 6 | só com dados atuais                                                                                             |
| Trecho sem luminária cadastrada                                     | 50 m     | 0,5                                                                                      | à noite ou de madrugada, e só se 60% dos trechos tiverem luminária carregada                                    |

Perfil à noite: crime e iluminação ×1,25. Idoso ou PCD: chamados ×2 e alagamento ×1,5. Criança: atropelamento ×1,5. A pontuação compara alternativas e é uma heurística revisável: os limites de nível vêm de 400 percursos de 1 km sorteados na capital com os dados de 2025 e 2026 (poucos abaixo de 22 pontos por km, a mediana; muitos a partir de 49, o percentil 85). Devem ser recalculados quando o conjunto importado mudar. Subnotificação, coordenadas aproximadas e ruas com mais denúncias ou movimento afetam o resultado, por isso a resposta sempre traz fontes, dados ausentes e o aviso de que não indica segurança.
