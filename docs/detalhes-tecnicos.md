# Detalhes técnicos do SafeWalk

Visão geral, Ficha da CitizenTech e prints no [README](../README.md).

A versão local mantém os 52 fluxos de referência e integra mapa vetorial real, busca de endereços, cálculo de rotas a pé, dados urbanos públicos e acompanhamento GPS sob autorização. Segurança e acessibilidade do percurso permanecem **não avaliadas**: o app mostra o que já foi registrado, sem certificar que um caminho é seguro.

## Rodar localmente

Requisitos: Node >= 22.13, npm e MariaDB do Wamp na porta 3307.

```powershell
cd C:\wamp64\www\safewalk
npm install
npm run db:setup
npm run db:migrate
npm run dev
```

- Web: http://localhost:8081 abre a proposta para investidores; o botão **Ver o app** leva a http://localhost:8081/app. API: http://localhost:4010/health.
- A proposta fica em http://localhost:8081/proposta/. É uma página estática em `apps/mobile/public/proposta`, publicada junto com a versão web do app. No celular, o aplicativo abre direto na entrada normal.
- `db:setup` atende à instalação local padrão do Wamp: cria banco/usuário restrito, sem imprimir credenciais ou substituir um `.env` existente. Para outra instalação, use `apps/api/.env.example` e execute as migrações. Em `NODE_ENV=production` a API recusa iniciar com `JWT_SECRET`/`DB_PASSWORD` de exemplo (`replace-with...`), `DEMO_MODE=true` ou `ALERT_WORKER_ENABLED=false`. Atrás do Passenger/proxy reverso defina `TRUST_PROXY=1` (saltos de proxy confiáveis; 0 = desligado) para que os limites de taxa usem o IP real do cliente. `/health` informa `alertWorker` (`enabled`/`disabled`).
- Confira a configuração pública dos serviços geográficos conforme [busca e rotas](routing-integration.md). Não são necessárias chaves para os endpoints comunitários usados neste piloto; a operação em produção exige configuração explícita.
- Para celular físico, configure `EXPO_PUBLIC_API_URL` com o endereço acessível da API na mesma rede e use `npm run dev:mobile`. O mapa nativo exige development build com o plugin MapLibre; Expo Go exibe essa limitação. Não há APK instalado ou teste em aparelho comprovado por um export web.

## Fluxo padrão: mapa e rota reais

1. Entre ou crie uma conta. Autorize os serviços externos em **Fontes de dados** antes de carregar tiles, buscar endereços ou calcular caminhos. A permissão GPS é separada e opcional.
2. No Início, consulte o mapa e suas camadas. A FIAP Paulista é uma referência inicial escolhida para a origem, sem alegar que o usuário está ali; altere a origem no mapa se necessário.
3. Busque um endereço real ou selecione o destino no mapa. Sem destino definido, `/rotas` solicita essa escolha, sem criar uma caminhada fictícia.
4. Confira a rota de pedestres calculada pelo Valhalla, suas instruções, distância, duração, fonte e validade. Alternativas vêm do provedor ou de um pedido que contorna os trechos com mais registros. Cada opção a pé mostra a leitura de registros conhecidos para o horário, sem selo de seguro/acessível.
5. Escolha contatos com convite aceito ou confirme que seguirá sem acompanhamento. Se quiser, cadastre o e-mail do contato e envie o convite. A pessoa pode aceitar e autorizar separadamente os avisos por e-mail. Configure seu PIN e inicie o trajeto.
6. No trajeto real, **Usar minha localização** ativa o GPS sob ação do usuário. A origem planejada não é uma posição GPS. O SOS permanece visível; encerramento/cancelamento exigem PIN. Se o GPS confirmar um desvio, o app tenta recalcular para o mesmo destino e perfil.
7. Compartilhe os links por contato. O acompanhamento apresenta o roteiro e a última posição recebida com horário; o ponto pode estar desatualizado. Encerrar revoga o acesso à localização.

Distâncias e durações de chegada/histórico usam o roteiro salvo, sem alegar distância efetivamente caminhada. O total de roteiros reais no histórico exclui distâncias ilustrativas.

### Recursos de segurança adicionais

- **Alerta por perda de sinal**: o servidor registra o instante da última posição recebida e, se o limite configurado (desligado/5/10/15 min) for excedido durante um trajeto, pede um check-in ao titular. No navegador, bloquear a tela interrompe a localização e pode disparar esse pedido. "Parar de enviar minha localização" desarma a detecção.
- **PIN de coação**: um segundo PIN que, digitado no cancelamento ou no encerramento, aparenta funcionar normalmente na tela do titular enquanto sinaliza um alerta silencioso aos contatos com link. Nenhuma mensagem externa é enviada automaticamente. Após o encerramento sob coação o aparelho para de transmitir GPS e os contatos veem a última posição recebida.
- **Locais salvos e início rápido**: Casa/Trabalho/Outro dentro da área de São Paulo permitem calcular a rota a partir da posição GPS atual ou de uma origem escolhida no mapa.
- **Modo tempo**: acompanhamento por duração (10–120 min), sem rota calculada, com check-in ao fim do prazo. Trajetos por tempo não somam distância no histórico.
- **Preferência de percurso**: Padrão, "Preferir iluminadas" e "Sem escadas" ajustam o pedido ao Valhalla. O critério depende de etiquetas do OpenStreetMap (iluminação, escadas), com cobertura parcial e sem verificação de condição real.
- **Aviso aos contatos**: botões de WhatsApp/SMS abrem a conversa com a mensagem pronta; o envio só acontece quando o usuário toca em enviar. O app não declara entrega automática.

**Explorar demonstração**, na tela de boas-vindas, abre a apresentação **Conheça o SafeWalk** (`/roteiro-demo`), que explica o produto em passos e separa o que funciona do que é simulado. Ela também fica em Segurança e pode iniciar uma caminhada de teste. O índice **Todas as telas** (`/telas-demo`) organiza a revisão dos grupos do protótipo e dos legados identificados como demonstração. A conta isolada de teste continua disponível. Isso não transforma a busca e a comparação padrão em um catálogo fictício; telas dependentes de trajeto, relato, convite ou link exigem um recurso válido. Consulte a [cobertura de telas](screen-coverage.md).

## Dados públicos integrados

O backend consulta sete camadas GeoSampa, importa SP156 e lê CGE/Open-Meteo: **10 fontes/camadas consultadas** na amostra local. Cada resultado inclui fonte, data quando disponível, cobertura, atribuição e validade operacional do cache. Polígonos de calçadas e inundação são preservados.

Última amostra do piloto Bela Vista/entorno, executada em 28/10/2026 no horário de São Paulo:

| Camada GeoSampa              | Feições recebidas |
| ---------------------------- | ----------------: |
| Calçadas                     |               300 |
| Iluminação pública           |               300 |
| Semáforos CET                |               300 |
| Histórico de alagamentos     |                 1 |
| Mancha de inundação modelada |               300 |
| Selo de acessibilidade SMPED |               118 |
| Equipamentos de saúde        |                 4 |

Essas contagens são recortes limitados, não cobertura completa. O lote SP156 validado reteve **1.255 solicitações públicas deduplicadas** na área piloto; a resposta limita-se a 1.000 e sinaliza truncamento. A amostra agregada continha 2.323 feições. O CGE retornou zero registros para a data consultada e é apresentado como resumo municipal, sem inventar pinos onde falta geometria. Open-Meteo fornece chuva **modelada**, sem detectar alagamentos.

Cadastro de luminária não prova luz acesa; largura/declividade de calçada não prova passagem livre; protocolo SP156 finalizado não prova reparo. Equipamento de saúde ou selo SMPED não implica parceiro SafeWalk, emergência, funcionamento 24h ou acolhimento verificado. A ausência de um registro não demonstra ausência de risco.

O cache é persistido no MariaDB e atualizado sob demanda. Para aquecer o piloto após migrações e compilação dos contratos:

```powershell
npx tsx apps/api/src/modules/urban-data/refresh-pilot.ts --output work/urban-validation.json
```

Um agendador pode executar esse utilitário para reconsultar fontes vencidas; **não foi instalado cron/agendamento na ValueHost**. A importação SP156 é uma operação administrativa em streaming a partir do CSV oficial, não uma transferência a cada movimento do mapa. Passos, limites e comandos estão em [dados urbanos](urban-data.md).

## GPS, persistência e privacidade

Consentimento dos serviços do mapa é registrado por conta no servidor. Endereços e coordenadas de origem/destino seguem para os provedores autorizados; tiles são carregados do OpenFreeMap. Revogar bloqueia novas consultas protegidas e novas posições de trajetos reais; não apaga automaticamente o histórico já salvo.

O GPS em primeiro plano usa Expo Location no aplicativo nativo e a geolocalização do navegador na web; transmite posições somente para o trajeto real ativo autorizado. No Início, uma posição com precisão acima de 150 m aparece como aproximada e não é usada automaticamente como origem: o usuário deve conferir o ponto no mapa. O acompanhamento continua exigindo precisão de até 150 m. No navegador, a localização depende da página ativa e das permissões do aparelho. `localhost` funciona como contexto seguro no próprio computador; para abrir pelo celular em outro endereço é necessário HTTPS. Não há garantia de execução com tela bloqueada.

Existe implementação nativa opcional com Expo TaskManager, permissão adicional e serviço de localização em segundo plano. Precisa de development build e teste em aparelho. O sistema pode interromper o processo por bateria, encerramento ou restrições do fabricante. Não é correto declarar essa execução validada com base em typecheck, bundle ou export.

No aparelho há um banco SQLite (`expo-sqlite`, em `apps/mobile/src/features/places/recent-destinations-store.ts`) só com os 8 últimos destinos de cada conta, apagado ao sair ou excluir a conta; na web o mesmo papel fica no `localStorage`, porque o SQLite do navegador exigiria cabeçalhos COOP/COEP que bloqueiam recursos de outros domínios do mapa.

Cadastros, preferências, contatos, e-mails, consentimentos, trajetos, posições, avaliações, relatos, fotos, PIN e links são persistidos. O contato consulta o servidor a cada cinco segundos; links expirados/revogados não continuam expondo localização. Prazos de resposta e escalada são persistidos, com alterações sensíveis protegidas por credencial.

Relatos no fluxo geral exigem um ponto selecionado no mapa e endereço/referência digitado pelo usuário. Durante o trajeto há um atalho com GPS e endereço reverso; fotos opcionais são comprimidas e têm metadados privados removidos. Compartilhar cada relato é opcional, usa coordenadas aproximadas e permite que outras pessoas confirmem se ainda existe. Os relatos não são verificados oficialmente nem enviados ao SP156.

## Limites e preparação para produção

- OpenFreeMap/OSM fornecem geometria e MapLibre renderiza 2D/3D com alturas disponíveis; não há fotogrametria, certificação de altura ou cobertura uniforme.
- Photon e Valhalla comunitários atendem ao piloto com uso moderado e sem SLA. Produção exige provedores/instâncias compatíveis ou autorização operacional explícita na configuração. O endpoint gratuito Open-Meteo tem condição de uso não comercial; uma operação comercial deve adotar serviço compatível com os termos.
- Não há modelo treinado de risco, garantia de acessibilidade ou navegação por voz. O recálculo após desvio usa GPS recente/preciso e serviços de rota; não verifica trânsito ao vivo. O contexto urbano próximo da rota é parcial, usa cache e não modifica o caminho calculado. As preferências "Preferir iluminadas" e "Sem escadas" dependem de etiquetas do OpenStreetMap e não verificam luz acesa ou acessibilidade real.
- Smart Sampa/câmeras, despacho GCM, push e envio oficial ao SP156/WhatsApp/SMS não estão integrados. Os botões de WhatsApp/SMS abrem a conversa com texto pronto e exigem o toque em enviar. Cenas legadas, pontos seguros e painel municipal mantêm rótulo de demonstração; não comprovam atendimento ou parceria real.
- Os e-mails de início e de alerta usam SMTP TLS do servidor. O de alerta sai sozinho quando o alerta começa (SOS, check-in sem resposta, perda de sinal ou PIN de coação), pelo processador de alertas (`ALERT_WORKER_ENABLED=true`), com até 3 tentativas. Configure `SAFEWALK_SMTP_HOST`, `SAFEWALK_SMTP_PORT=465`, `SAFEWALK_SMTP_USER`, `SAFEWALK_SMTP_PASSWORD`, `SAFEWALK_SMTP_FROM` e `SAFEWALK_SMTP_SECURE=true`, além de `DEMO_MODE=false` e `PUBLIC_WEB_URL` HTTPS. Sem isso o trajeto inicia normalmente, mas os avisos ficam como não configurados. “Aceito pelo servidor” não comprova entrega na caixa de entrada.
- "Esqueci minha senha" (app e painel) usa o mesmo SMTP: link de uso único, válido por 30 minutos, que abre `/redefinir-senha` em `PUBLIC_WEB_URL` (app) ou `ADMIN_PANEL_URL` (painel), ambos HTTPS em produção. Trocar a senha encerra as sessões abertas antes (migração 024). Sem SMTP fora de produção, a resposta traz o link (`previewUrl`) para teste local; em produção sem SMTP nada é enviado e a API registra o erro.
- O armazenamento de fotos deve ficar em disco privado, persistente e protegido por backup, configurado com `SAFEWALK_REPORT_PHOTO_DIR`. As migrations 015–017 precisam ser aplicadas antes de iniciar a API atualizada.
- O PIN de coação não envia mensagens nem aciona serviços de emergência: ele muda o estado visível aos contatos com link. Após o encerramento sob coação o aparelho interrompe o GPS e os contatos passam a ver somente a última posição recebida com o alerta silencioso.
- O alerta por perda de sinal mede a última posição que chegou ao servidor, não a posição atual. No navegador, bloquear a tela ou suspender a aba interrompe a transmissão e pode disparar o check-in; isso não é garantido em todas as plataformas.
- O processador local confere prazos a cada cinco segundos. A execução contínua, reinício e capacidade sob Passenger/ValueHost precisam de validação antes da publicação; não há garantia operacional de temporização na hospedagem.
- Retenção, exportação e exclusão agendada existem, mas sua operação contínua e política aplicável precisam de validação. O painel municipal continua local/demonstrativo, sem autenticação institucional ou acesso a câmeras reais.
- Banco local MariaDB 11.5.2; SQL deve continuar compatível com MariaDB 10.11 da hospedagem e ser validado nessa versão. PDF/compartilhamento nativos também precisam de teste em dispositivo.
- Nenhuma aplicação existente na ValueHost foi publicada, reiniciada ou alterada por estas integrações locais.

## Painel da Prefeitura (demonstração)

Aplicativo web separado (`apps/admin`) onde um operador vê os relatos de zeladoria (buraco, semáforo com defeito, alagamento, rua sem luz, calçada, obra, passagem bloqueada) que as pessoas escolheram enviar pelo app, muda o andamento e acompanha os pontos críticos. É uma demonstração: não há integração com o SP156 nem canal oficial da Prefeitura, e o painel nunca recebe nome, e-mail ou identificador de quem relatou.

```powershell
npm run db:migrate                      # cria admin_users e o histórico do painel (migração 023)
$env:ADMIN_PASSWORD = '<senha com 12+ caracteres>'
npm run admin:create -w @safewalk/api -- operador@exemplo.local "Nome do operador" operator   # ou viewer (só consulta)
npm run admin:seed -w @safewalk/api     # opcional: relatos de exemplo (precisa DEMO_MODE=true e a API no ar)
npm run dev:admin                       # http://127.0.0.1:5190
```

Sem `ADMIN_PASSWORD`, o `admin:create` gera uma senha forte e a mostra uma única vez. Adicione a origem do painel (`http://127.0.0.1:5190`, ou o endereço real) em `WEB_ORIGINS` da API. O painel lê `VITE_API_URL` (padrão `http://127.0.0.1:4010`) e guarda a sessão só na aba. Detalhes em [arquitetura](architecture.md). O `package:valuehost` inclui o painel (`safewalk-painel.tar.gz`, a partir de `apps/admin/dist`): antes, faça `npm run build -w @safewalk/admin` com `VITE_API_URL` da API remota. Operadores esquecidos usam "Esqueci minha senha" no próprio painel (precisa de `ADMIN_PANEL_URL` e SMTP na API). Publicação atual em [docs/valuehost.md](valuehost.md). Nunca rode `admin:seed` em produção.

## Qualidade

```powershell
npm run typecheck
npm run lint
npm test  # unitários da API e do mobile
npm run test:integration -w @safewalk/api  # API local e MariaDB iniciados; reinicie a API entre execuções (limite de requisições em memória)
node --import tsx --test apps/mobile/src/components/map/real-map.test.mjs
npm run format:check
npm run build
```

Os testes de integração usam loopback/contas sintéticas e verificam isolamento, prazos, PIN, convites, posições, snapshot de rotas, consentimento, importação/cache e revogação de links. Consulte as documentações específicas para as amostras externas executadas. A aprovação de testes não certifica a qualidade dos dados urbanos nem a execução nativa em aparelho.

## Publicação

Tudo que entra na `main` do GitHub é testado (tipos, lint e testes) e, se passar, publicado sozinho no servidor em até uns 10 minutos: app em https://safewalk.recapture.com.br, painel em https://painel.safewalk.recapture.com.br e API em https://api.safewalk.recapture.com.br. O servidor busca a versão nova com uma chave somente leitura; ninguém precisa de acesso à hospedagem. Como colaborar: [CONTRIBUTING.md](../CONTRIBUTING.md). Detalhes: [docs/valuehost.md](valuehost.md).

## Estrutura e referências

- [AGENTS.md](../AGENTS.md) e [CONTRIBUTING.md](../CONTRIBUTING.md): regras de desenvolvimento.
- [Arquitetura](architecture.md), [referência visual](prototype-map.md) e [cobertura dos 52 fluxos](screen-coverage.md).
- [Renderização real do mapa](map-rendering.md), [busca/rotas](routing-integration.md) e [fontes urbanas/importação](urban-data.md).
- [Preparação da hospedagem](valuehost.md).

Estilos nativos permanecem externos em `.styles.ts`; CSS web fica em arquivos `.css` separados, com tokens centralizados. As rotas Expo apontam para as funcionalidades. O worker MapLibre é copiado automaticamente nos comandos npm de desenvolvimento/exportação; não contém credenciais.

Apache bloqueia acesso à pasta de fontes por `.htaccess`. A prévia usa Metro/API. Publique somente os arquivos exportados da web em `public_html`, mantendo API, banco e segredos fora dessa pasta.

O mapa do percurso apresenta os registros urbanos próximos ao traçado com fonte/data, atualiza clima e destaca áreas de inundação conhecidas quando há indicação recente de chuva. O perfil de acessibilidade pede rotas para evitar escadas e destaca infraestrutura cadastrada. Cobertura parcial não equivale a segurança ou acessibilidade certificadas; veja [prototype-map.md](prototype-map.md).

A comparação e o trajeto iniciado oferecem camadas Automático/Personalizado/Todos, semáforos identificados, agrupamento com lista completa e contornos por seleção. A visão automática considera perfil, horário de São Paulo e chuva recente; não classifica segurança pela quantidade de registros.
