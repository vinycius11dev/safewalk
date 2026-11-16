# Arquitetura do SafeWalk

Versão local Expo/React Native/API/MariaDB com os 52 fluxos de referência e novas integrações reais de mapas, endereços, rotas pedestres e dados urbanos. A interface preserva temas e estrutura visual do protótipo; a condição de segurança/acessibilidade permanece não avaliada. Banco local: MariaDB 11.5.2; hospedagem inspecionada: MariaDB 10.11.19. Validar migrações na versão da hospedagem antes de publicar.

## Organização

```text
safewalk/
  apps/mobile/
    src/app/                    rotas e layouts Expo Router
    src/features/maps/          consentimento, origem/destino, busca, rotas e fontes urbanas
    src/features/location/      GPS opt-in e tarefa nativa opcional
    src/features/               conta, contatos, trajetos, acompanhamento, relatos e painel
    src/components/map/         adaptadores MapLibre web/nativo, modelo GeoJSON e estilos
    src/theme/                  tokens claro/escuro, medidas e tipografia
    src/lib/                    HTTP, sessão e configuração pública
  apps/api/
    src/config/                 ambiente validado e provedores permitidos
    src/database/               pool, migrações e transações
    src/middleware/             autenticação, erros e validação HTTP
    src/modules/map-settings/   consentimento persistido por conta
    src/modules/routing/        busca, cálculo, propostas e snapshot/contexto da rota
    src/modules/places/         locais salvos (Casa/Trabalho/Outro) dentro da área de São Paulo
    src/modules/urban-data/     leitura, cache, importação e atualização do piloto
    src/modules/                auth, contacts, trips, reports e tracking
    src/integrations/routing/   adaptadores Photon/Valhalla e transporte externo limitado
    src/integrations/urban/     GeoSampa, SP156, CGE e Open-Meteo
    src/domain/                 regras puras e estados de alerta
    src/jobs/                   prazos persistidos e manutenção
  packages/contracts/           schemas Zod, geometria, proveniência e contratos HTTP
  database/migrations/          histórico SQL versionado
  docs/                         decisões, limites e correspondência do protótipo
  scripts/                      ambiente local e preparação de publicação
```

Componentes chamam hooks/serviços; não fazem `fetch` direto. O fluxo da API é rota HTTP → serviço → repositório → banco, com SQL parametrizado. Adaptadores externos têm limites e validação próprios. Credenciais/configuração privada permanecem no servidor.

## Plataforma e estilos

1. Expo SDK 58, React Native 0.88 e React 19.3; Expo Router e TypeScript estrito.
2. Aplicação universal, com adaptadores por plataforma quando o recurso exige motores diferentes.
3. A sessão fica em `expo-secure-store` no nativo e em `sessionStorage` na web, onde o token é legível por XSS (risco aceito enquanto a API usar Bearer; cookie HttpOnly exigiria mudar a API), sendo validada com o schema compartilhado ao ler e descartada se corrompida.
4. Estilos nativos em `.styles.ts` com `StyleSheet.create`; CSS de navegador em `.css`, separado do JSX e sem dependência do CSS no componente nativo. Tokens de tema ficam em `src/theme`.
5. MapLibre GL JS 6.16.0 no web e MapLibre React Native 11.5.0 no nativo. O adaptador web carrega GL JS dinamicamente; o nativo usa `Map`, `Camera`, `GeoJSONSource` e `Layer`, sem WebView.
6. O worker oficial GL JS é copiado da versão instalada para `public/maplibre-worker.mjs` nos scripts `prestart`, `preweb` e `prebuild:web`. O export inclui esse arquivo. Publicação sob subpasta requer ajustar a base do worker.
7. OpenFreeMap/OSM fornecem tiles vetoriais e glyphs. O estilo SafeWalk local usa as paletas existentes e mantém atribuição visível. 3D altera a câmera e usa alturas cadastrais disponíveis, sem inventar alturas ou substituir falhas por desenho fictício.

Detalhes de API, WebGL, compatibilidade e development build em [renderização do mapa](map-rendering.md).

## Contratos e endpoints geográficos

| Endpoint                                  | Papel                                                                                                                                                                                                                                                         | Proteção                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET /api/maps/consent`                   | Estado e versão do consentimento do mapa                                                                                                                                                                                                                      | Sessão                                                            |
| `PUT /api/maps/consent`                   | Autorizar/revogar serviços externos                                                                                                                                                                                                                           | Sessão + entrada validada                                         |
| `GET /api/geocoding/search`               | Endereços Photon                                                                                                                                                                                                                                              | Sessão + consentimento + limitação                                |
| `GET /api/geocoding/reverse`              | Endereço próximo do ponto escolhido                                                                                                                                                                                                                           | Sessão + consentimento + limitação                                |
| `POST /api/routing/routes`                | Rotas `pedestrian` Valhalla                                                                                                                                                                                                                                   | Sessão + consentimento + limitação                                |
| `GET /api/urban/sources`                  | Proveniência/status das fontes                                                                                                                                                                                                                                | Sessão; disponível antes de autorizar mapas                       |
| `GET /api/urban/layers`                   | GeoJSON por bbox/tipos + resumo/tempo                                                                                                                                                                                                                         | Sessão + consentimento + limitação                                |
| `POST /api/trips` com `routeId`           | Iniciar com proposta do usuário e salvar percurso                                                                                                                                                                                                             | Sessão, propriedade/validade e regras do trajeto                  |
| `POST /api/trips` com `timerMinutes`      | Iniciar acompanhamento por tempo, sem rota                                                                                                                                                                                                                    | Sessão e regras do trajeto                                        |
| `POST /api/trips/:id/positions/pause`     | Pausar envio e desarmar a detecção de perda de sinal                                                                                                                                                                                                          | Sessão + propriedade                                              |
| `PUT/DELETE /api/auth/duress-pin`         | Configurar/remover o PIN de coação                                                                                                                                                                                                                            | Sessão + PIN principal                                            |
| `DELETE /api/trips/:id/shares/:contactId` | Titular revoga os links ativos de um contato (`owner_revoked`, idempotente); gerar novos links mantém os anteriores válidos (o contato pode ter recebido o primeiro por e-mail durante um SOS) e é limitado a 1 vez por 10 s (`SHARE_LINK_RATE_LIMITED`, 429) | Sessão + propriedade do trajeto; sem PIN, pois só reduz exposição |
| `GET/POST/PUT/DELETE /api/places`         | Locais salvos do titular na área de São Paulo                                                                                                                                                                                                                 | Sessão + propriedade por recurso                                  |

O consentimento `public-maps-v1` é salvo em `map_consents`, separado da permissão de localização do sistema. Busca/cálculo enviam termos e coordenadas aos provedores. A interface só monta o mapa externo após autorização. O acompanhamento público carrega o mapa sozinho: posições e rotas reais só existem quando o titular autorizou os serviços do mapa, então o contato não precisa tocar em um botão durante um alerta. Endpoints protegidos não continuam aceitando consultas após revogação. Respostas privadas não devem ser reutilizadas entre usuários.

Falhas externas produzem erro/indisponibilidade explícitos. Não há geometria fictícia como fallback, perfil de carro apresentado como pedestre nem escore verde por ausência de informação. A camada legada `MapScene` permanece apenas nos cenários identificados como demonstração.

## Rota planejada, localização e acompanhamento

Photon resolve endereços e Valhalla calcula caminhos a pé, com instruções, distância, duração e atribuição. A geometria GeoJSON usa longitude antes de latitude. A API mantém `riskLabel: desconhecido`, segurança/acessibilidade `not_assessed` e alternativas somente quando o motor as fornece.

`routing_cache` armazena resultados com prazo; `route_proposals` vincula a opção ao usuário e expira a proposta para iniciar. `trips.route_snapshot` persiste a cópia validada pelo servidor, sem confiar em geometria enviada pelo cliente. Expiração da proposta não invalida um percurso já iniciado. O snapshot passa ao acompanhamento e ao histórico.

O contexto opcional da rota aproxima registros já em cache de uma faixa de 50 metros, com fonte/data e cobertura parcial. Não consulta serviços externos adicionais nem muda o trajeto ou seu risco. A mesma foto do contexto fica no snapshot. Leia [busca e rotas](routing-integration.md) para prazos, limites, operação comunitária e configuração de produção.

`useMapJourney` separa origem/destino escolhidos e rota selecionada da posição GPS. FIAP Paulista é uma referência manual inicial; não representa posição atual. Sem destino, o fluxo solicita escolha. Contatos e estado sem acompanhantes usam rótulos/métricas do percurso escolhido, sem repetir os exemplos fixos do protótipo.

Expo Location inicia somente após ação do usuário e autorização necessária. `LocationProvider` acompanha a sessão e transmite posições para o único trajeto real ativo, mantendo precisão e instante da fixação; falhas de transmissão aparecem na interface. Encerramento/revogação interrompem o acompanhamento do fluxo ativo. A posição no link do contato é sempre a última recebida, com horário, sem garantia de atualidade.

No nativo existe tarefa Expo TaskManager opcional, armazenamento restrito da associação de sessão/trajeto e permissão adicional. A execução pode ser interrompida pelo sistema; precisa de development build e teste em aparelho. No web o fluxo é em primeiro plano, sujeito à página ativa e às regras do navegador. Nenhuma dessas implementações autoriza declarar rastreamento com tela bloqueada validado.

O servidor continua responsável por prazos de check-in/SOS, transições atômicas, credencial do titular e revogação dos links. Reconhecer um alerta pelo contato não cancela SOS. Nenhum estado privado confirma despacho real a GCM/Smart Sampa. Os e-mails de início e de alerta são enviados somente aos contatos selecionados, com convite aceito e consentimento específico; `accepted_by_relay` significa aceitação pelo SMTP, não entrega confirmada.

### Recursos de segurança adicionais

- **Perda de sinal**: `trips.last_position_received_at` registra a última posição gravada; `users.signal_loss_minutes` (0/5/10/15) define o limite. O processador de alertas transiciona o trajeto para `checkin_pending` com `alert_reason` `signal_lost` (ou `late` por atraso/fim de tempo) e os prazos persistem no banco. `POST /positions/pause` zera o marcador e grava o evento de pausa.
- **PIN de coação**: `users.duress_pin_hash` guarda um segundo segredo. Cancelamento/encerramento com esse PIN disfarçam a resposta ao titular, marcam `trips.duress_at`/`duress_disguised` e mantêm o link de acompanhamento mostrando o alerta silencioso. `shareLinkState` admite o estado de coação e o serializador separa visão do titular e do contato.
- **Modo tempo**: `trips.mode` (`route`/`timer`/`demo`) distingue trajeto por duração; `route_snapshot` fica nulo e o consentimento de posição vale para qualquer modo não demonstrativo.
- **E-mail de início**: contatos podem cadastrar e-mail; o destinatário recebe convite por link de uso único, visualiza o endereço mascarado e pode autorizar avisos separadamente. O trajeto envia link apenas aos contatos selecionados, aceitos e autorizados. SMTP exige TLS implícito, `DEMO_MODE=false`, `PUBLIC_WEB_URL` HTTPS e variáveis `SAFEWALK_SMTP_*`; falha de e-mail nunca desfaz o trajeto. Nenhum teste envia mensagens reais.
- **E-mail automático de alerta**: quando o alerta começa (SOS manual, check-in sem resposta, perda de sinal ou PIN de coação), a mesma transação grava uma linha por contato em `contact_alert_messages`, única por trajeto, contato, canal e instante do alerta. O processador de alertas reserva as linhas vencidas (`FOR UPDATE SKIP LOCKED`, concessão de 2 min), emite um link novo para cada contato (só o hash é guardado, com o prazo do link ativo e `issued_at` nulo para não contar no limite de reemissão) e envia o e-mail fora da transação. Falhas são tentadas de novo até 3 vezes (pausa de 30 s e 60 s) e depois ficam `failed`. Sem consentimento, com o link revogado pelo titular ou sem SMTP, nada sai do servidor (`not_enabled`/`not_configured`). Cancelar ou encerrar com o PIN principal descarta o que ainda está `pending`. A entrega é "ao menos uma vez": se o processo parar depois do aceite do SMTP e antes do registro, o e-mail sai de novo. O titular vê o estado do alerta mais recente em `alertMessages`, escondido sob coação; sob coação o texto pede ao contato que não mencione o aviso. SMS e WhatsApp automáticos exigem um provedor contratado e continuam manuais.
- **Recálculo de rota**: três posições GPS precisas e recentes precisam confirmar o desvio antes do POST `/api/trips/:id/reroute`. A API usa a última posição recebida e os dados persistidos de destino/perfil/preferência; cooldown e lock evitam repetição. Um recálculo bem-sucedido atualiza snapshot/ETA e registra evento sem recriar links ou contatos. Falha preserva a rota existente.
- **Locais salvos**: `saved_places` persiste Casa/Trabalho/Outro por usuário, dentro da área de serviço de São Paulo, e entra na exportação de dados pessoais.
- **Preferência de percurso**: o pedido ao Valhalla aceita `preference` (`standard`/`prefer_lit`/`step_free`) e cada alternativa herdada declara o critério em sua descrição; a preferência fica no snapshot. Com critério não padrão, o servidor faz uma consulta extra `standard` ao provedor — também em cache de cinco minutos, com falha ignorada — e anexa as alternativas novas depois das preferidas, até quatro opções.
- **Perfil de caminhada**: para rotas a pé, `calculateRoutes` lê `walking_profile` da conta (nunca do corpo do pedido) e soma ao critério as opções de custo do perfil (`walkingProfileCosting` em `valhalla.ts`): `pcd` usa `walking_speed` 3,6 e `use_hills` 0,1; `child` favorece calçadas e caminhos de pedestre e penaliza vielas e acessos. O perfil entra na chave do cache e fica em `walkingProfile` no snapshot da rota. Exceção por trajeto: com `wheelchair: true` no pedido (`resolveRouteRequest`), o cálculo usa `step_free` e o custo `pcd`, sem alterar a conta; a marca fica no snapshot e é repetida no recálculo. O link do contato recebe a rota sem `wheelchair`, sem `walkingProfile` e com descrição genérica (`routeForContact`); o aviso só chega por `wheelchairShared`, gravado em `trips.wheelchair_shared` quando o titular marca `shareWheelchair` em uma rota calculada com `wheelchair`.
- **Pedido às câmeras (simulado)**: `recordCameraRequest` grava o evento `smart_sampa_image_request_simulated` (`externalRequestSent: false`, sem coordenadas) quando o trajeto passa a `alerted` (SOS manual ou job de prazos) e no PIN de coação. `serializeTrip` devolve o mais recente em `cameraRequest` (`domain/camera-request.ts`: raio 150 m, janela −10/+15 min, referência última posição/rota/nenhuma), oculto ao titular sob coação. As etapas de teste exibidas no SOS e no link do contato (`cameraSimulationSteps`, +20 s e +60 s) são derivadas só de `requestedAt` no app; nenhum estado de central é persistido ou consultado.
- **Criança acompanhada**: com `walking_profile = 'child'`, `POST /trips` exige `adultAccompanying: true` e responde `409 ADULT_COMPANION_REQUIRED` sem ele. O app mostra a confirmação nas telas de início (`AdultCompanionCheck`) e a pede de novo a cada trajeto.

## Dados urbanos e operação

Sete camadas GeoSampa preservam polígonos/pontos de calçadas, iluminação, semáforos, histórico/mancha de inundação, SMPED e saúde. SP156 entra por importação oficial em streaming. CGE fornece resumo municipal sem geometria verificada; Open-Meteo entrega chuva modelada, sem detector de alagamentos. Fonte, referência temporal, cobertura, atribuição e status acompanham cada leitura.

As tabelas `urban_provider_cache`, `urban_imports` e `urban_import_features` persistem cache, lotes e feições. A atualização sob demanda agrupa chamadas equivalentes, arredonda bbox e limita tempo, corpo, área, concorrência e feições. Falha preserva a leitura anterior como vencida; banco indisponível não vira armazenamento em memória. O mapa informa truncamento e limita consultas após movimento/debounce/zoom mínimo.

A amostra local consultou 10 fontes/camadas e a importação piloto SP156 reteve 1.255 solicitações deduplicadas, com limite de 1.000 por resposta. Os detalhes e as sete contagens GeoSampa estão no [README](../README.md) e na [documentação urbana](urban-data.md); são recortes de uma execução, sem promessa de cobertura de São Paulo.

`refresh-pilot.ts` permite aquecimento por agendador opcional, consultando apenas TTL vencido. `import-city-layers.ts` (`npm run import:city-layers -w @safewalk/api`) importa os semáforos da capital (GeoSampa) e de 13 municípios vizinhos (OpenStreetMap/Overpass) para a visão da cidade. `import-sp156.ts` substitui atomicamente um lote validado do CSV oficial, sem geocodificar coordenadas ausentes ou importar identidade/texto livre do solicitante. Não existe endpoint público de importação. Nenhum cron/agendamento remoto foi criado.

Datas de carga/cadastro não são vistorias. Selo SMPED, equipamento de saúde, iluminação e protocolo finalizado não validam passagem livre, luz acesa, atendimento ou reparo. A classe de transitabilidade CGE é veicular; histórico, suscetibilidade/modelo e ocorrência ativa não são intercambiáveis.

## Relatos, métricas e legados

Relatos no fluxo geral exigem ponto confirmado e endereço/referência digitado. Durante trajeto, a ação rápida usa GPS atual e endereço reverso somente depois do toque. Publicar na comunidade exige escolha individual e a preferência global `contribute_reports`; o ponto público é arredondado, a autoria não aparece e o estado é “não verificado”. Votos não substituem vistoria oficial; três sinalizações distintas ocultam o item para revisão comunitária. Fotos JPEG/PNG têm até 3 MB, são regravadas sem EXIF e ficam em diretório privado fora da camada estática; o endpoint de leitura exige sessão e consentimento ativo do autor para acesso comunitário. A API não envia relatos ao SP156.

### Painel da Prefeitura (demonstração)

`apps/admin` (Vite, React e MapLibre) consome somente `/api/admin`, validando as respostas com os schemas de `@safewalk/contracts`. A API mantém o painel isolado do app do cidadão: contas próprias em `admin_users` (senha com scrypt, bloqueio crescente após 5 erros, perfil `viewer` ou `operator` lido do banco a cada chamada), token com audiência `safewalk-admin` que o app não aceita e vice-versa, e limite de tentativas no login. Contas se criam por `npm run admin:create -w @safewalk/api`; não existe cadastro público.

O envio é consentido relato a relato (`reports.share_with_government`) e só vale para tipos de zeladoria (`governmentReportTypes`); o painel lê `reports` filtrando por essa marca e não seleciona `user_id`, nome nem e-mail. O andamento fica em `reports.gov_status` e cada mudança grava, na mesma transação, uma linha em `report_admin_events` (quem, de qual para qual estado, nota e instante UTC). Prioridade (`domain/report-priority.ts`) e pontos críticos (`domain/report-hotspots.ts`) são regras fixas e testadas, com a mesma janela de ~100 m. A foto sai por `/api/admin/reports/:id/photo`, só para relatos enviados ao painel. A exclusão da conta do cidadão apaga seus relatos e o histórico deles; a retenção configurada por ele também vale para os relatos enviados ao painel.

`npm run admin:seed -w @safewalk/api` cria relatos de exemplo (descrições começando com "[Exemplo]") e só roda com `DEMO_MODE=true` fora de produção. O teste de integração do painel remove o que cria (`admin:cleanup-tests`). Não há integração com SP156, sistema de ordens de serviço ou canal oficial da Prefeitura.

Chegada/histórico usam distância e duração do snapshot real como estimativas planejadas. O total de distância real do histórico não soma metros fictícios dos trajetos de demonstração. Fluxos municipais, câmeras, pontos seguros legados e cenários de ocorrência mantêm identificação de demonstração.

## Hospedagem e ferramentas

- Fonte sob Wamp protegida por `.htaccess`; produção publica somente o export web em `public_html`. API, banco e segredos ficam fora da pasta pública.
- Provedores comunitários Photon/Valhalla e OpenFreeMap não oferecem SLA operacional para o aplicativo. Configurar capacidade, termos e instâncias de produção antes do uso público; o gratuito Open-Meteo é limitado a uso não comercial.
- O diretório `SAFEWALK_REPORT_PHOTO_DIR` deve ser privado, persistente e gravável pela API; configure backup e retenção. Para e-mail, configure as variáveis SMTP no servidor sem versionar credenciais. O modo de demonstração bloqueia todo envio externo.
- O processador local recupera prazos do banco após reinício. Operação contínua e temporização sob Passenger/ValueHost ainda precisam de validação; nenhum deploy remoto foi realizado.
- ESLint 9 atende ao preset Expo utilizado. Não forçar mudança principal nem `npm audit fix --force` que rebaixe/troque o SDK. GL JS 6.16 substitui a linha vulnerável 5; avisos transitivos de Expo CLI continuam documentados em [map-rendering.md](map-rendering.md).
- Typecheck, lint, testes de geometria/proveniência e exportação verificam partes diferentes. Bundle/export não significa APK instalado nem teste de GPS, permissões ou serviços nativos em aparelho.

## Referências

[Expo SDK58](https://docs.expo.dev/versions/v58.0.0/), [Expo Router](https://docs.expo.dev/router/basics/core-concepts), [estilos React Native](https://reactnative.dev/docs/style), [TypeScript estrito](https://www.typescriptlang.org/tsconfig/strict.html). As fontes e termos dos provedores estão em [map-rendering.md](map-rendering.md), [routing-integration.md](routing-integration.md) e [urban-data.md](urban-data.md).
