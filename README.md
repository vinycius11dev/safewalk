<div align="center">

<img src="docs/readme/banner.svg" alt="SafeWalk: caminhe por São Paulo com mais contexto" width="100%" />

<br />

[![CI: GitHub Actions](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/vinycius11dev/safewalk/actions/workflows/release.yml)
![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white)
![React Native 0.88](https://img.shields.io/badge/React%20Native-0.88-149ECA?logo=react&logoColor=white)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Node.js 22](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white)
![MariaDB](https://img.shields.io/badge/MariaDB-servidor-003545?logo=mariadb&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-no%20aparelho-003B57?logo=sqlite&logoColor=white)

**[Abrir o app](https://safewalk.recapture.com.br/app)** · **[Apresentação](https://safewalk.recapture.com.br/proposta/)** · **[Painel da Prefeitura](https://painel.safewalk.recapture.com.br)** · **[Vídeo](#-vídeo)**

Global Solution FIAP 2026.2 · CitizenTech · Engenharia de Software, 3º ano

</div>

---

## Sumário

- [Sobre o projeto](#-sobre-o-projeto)
- [Ficha da CitizenTech](#-ficha-da-citizentech)
- [Equipe](#-equipe)
- [Vídeo](#-vídeo)
- [Links da entrega](#-links-da-entrega)
- [Telas do app](#-telas-do-app)
- [Painel da Prefeitura](#painel-da-prefeitura)
- [Entrega de Mobile Development & IoT](#-entrega-de-mobile-development--iot)
- [Entrega de IA & Machine Learning](#-entrega-de-ia--machine-learning)
- [O projeto em números](#-o-projeto-em-números)
- [Arquitetura](#-arquitetura)
- [Banco de dados](#-banco-de-dados)
- [Identidade visual](#-identidade-visual)
- [Como rodar](#-como-rodar)
- [Qualidade e publicação](#-qualidade-e-publicação)
- [Documentação](#-documentação)

## 🚶 Sobre o projeto

Quem volta a pé sozinho, principalmente à noite, não sabe o que vai encontrar no caminho. Pode ter rua escura, buraco, alagamento ou calçada ruim, e se algo acontecer, ninguém de confiança fica sabendo a tempo.

O **SafeWalk** é um aplicativo Expo/React Native para quem anda a pé por São Paulo:

- **Planeja a rota a pé** e mostra o que já foi registrado no caminho, com dados públicos da cidade: iluminação, semáforos, calçadas, alagamentos, solicitações SP156 e chuva.
- **Avisa contatos de confiança.** Eles recebem um link com o roteiro e a última posição recebida.
- **Protege durante o trajeto** com SOS, check-in quando a pessoa passa do horário, alerta por perda de sinal e PIN de coação.
- **Leva os problemas da rua à Prefeitura.** O cidadão relata e escolhe se envia ao painel municipal.

> O app mostra registros públicos e o que as pessoas relataram. Ele **não certifica** que um caminho é seguro ou acessível.

## 📋 Ficha da CitizenTech

| Campo                      | Resposta                                                                                                                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | SafeWalk                                                                                                                                                                                                                               |
| **Cidade e bairro**        | São Paulo (SP). Piloto na Bela Vista e no entorno da Avenida Paulista, onde fica a FIAP Paulista.                                                                                                                                      |
| **Cidadão beneficiado**    | Quem anda a pé sozinho, principalmente à noite: estudantes saindo da faculdade, trabalhadores, idosos e pessoas com deficiência ou mobilidade reduzida.                                                                                |
| **Problema, em uma frase** | Quem volta a pé sozinho não sabe o que vai encontrar no caminho e, se algo acontecer, ninguém de confiança fica sabendo a tempo.                                                                                                       |
| **Como funciona**          | A pessoa busca o destino, compara rotas a pé com os registros públicos do trajeto, escolhe quem acompanha e inicia a caminhada. Se não confirmar a chegada, o app pede um check-in e mostra o alerta a quem acompanha.                 |
| **O que cada parte faz**   | **App** (`apps/mobile`): jornada do cidadão. **API** (`apps/api`): regras, contas, dados urbanos e alertas. **Banco** (`database`): MariaDB no servidor e SQLite no aparelho. **Painel** (`apps/admin`): relatos para a Prefeitura.    |
| **Link do repositório**    | https://github.com/vinycius11dev/safewalk                                                                                                                                                                                              |
| **Indicador de impacto**   | Percentual de caminhadas encerradas com "Cheguei bem"; tempo entre um alerta e a visualização pelo contato; relatos de zeladoria enviados e resolvidos pela Prefeitura.                                                                |
| **ODS conectados**         | **11** (11.2 e 11.7): deslocamento a pé e espaços públicos mais seguros. **10** (10.2): perfil Idoso/PCD e rota para cadeirante. **3** (3.6): sinistros e semáforos no percurso. **13** (13.1): alerta de chuva e áreas de alagamento. |

## 👥 Equipe

| Integrante       |     RM |
| ---------------- | -----: |
| Enzo Dias        | 558225 |
| Gabriel Dias     | 556830 |
| Gabriel Galerani | 557421 |
| Gustavo Alves    | 557876 |
| Leonardo Taschin | 554583 |

## 🎬 Vídeo

**Vídeo de até 3 minutos com o app rodando:** _cole aqui o link do YouTube_

O roteiro está em [docs/video-mobile.md](docs/video-mobile.md). No vídeo aparecem, com o app publicado:

- a Marina criando a conta, buscando o destino e comparando as rotas a pé;
- a mãe recebendo o e-mail e abrindo o link de acompanhamento;
- a Marina saindo do caminho, o app confirmando o desvio e recalculando a rota, e a mãe vendo "Rota recalculada";
- o SOS, o alerta que chega para a mãe e a chegada com "Cheguei bem";
- um relato de rua sem luz chegando ao painel da Prefeitura e o andamento voltando ao app;
- o PIN de coação e o perfil Idoso/PCD, que prefere caminhos sem escadas e sem ladeiras, mesmo que mais longos, e pesa mais buracos e calçadas ruins.

## 🔗 Links da entrega

| O quê                    | Onde                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **App publicado** (web)  | https://safewalk.recapture.com.br/app (abre no navegador do celular, sem instalar nada)                                |
| **Painel da Prefeitura** | https://painel.safewalk.recapture.com.br (acesso com conta de operador, criada pela equipe)                            |
| **Apresentação**         | https://safewalk.recapture.com.br/proposta/                                                                            |
| **API**                  | https://api.safewalk.recapture.com.br/health                                                                           |
| **Repositório**          | https://github.com/vinycius11dev/safewalk                                                                              |
| **Publicação**           | [GitHub Actions](https://github.com/vinycius11dev/safewalk/actions/workflows/release.yml): testa e publica cada versão |

## 📱 Telas do app

|                                            Boas-vindas                                            |                                        Cadastro                                         |                                                 Início                                                  |                                                   Buscar                                                   |                                                   Recentes                                                   |
| :-----------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------: |
|     <img src="docs/prints/mobile/01-boas-vindas.png" width="165" alt="Tela de boas-vindas" />     |  <img src="docs/prints/mobile/02-cadastro.png" width="165" alt="Cadastro de conta" />   | <img src="docs/prints/mobile/03-inicio-mapa.png" width="165" alt="Início com mapa e ajuda por perto" /> | <img src="docs/prints/mobile/04-buscar-endereco.png" width="165" alt="Busca de endereço com resultados" /> | <img src="docs/prints/mobile/10-destinos-recentes.png" width="165" alt="Destinos recentes do banco local" /> |
|                                        **Comparar rotas**                                         |                                      **Caminhada**                                      |                                               **Relatar**                                               |                                                **Contatos**                                                |                                                  **Perfil**                                                  |
| <img src="docs/prints/mobile/05-comparar-rotas.png" width="165" alt="Comparação de rotas a pé" /> | <img src="docs/prints/mobile/06-trajeto-sos.png" width="165" alt="Caminhada com SOS" /> |        <img src="docs/prints/mobile/07-relatar.png" width="165" alt="Relatar problema da rua" />        |          <img src="docs/prints/mobile/08-contatos.png" width="165" alt="Contatos de segurança" />          |  <img src="docs/prints/mobile/09-perfil-seguranca.png" width="165" alt="Perfil de caminhada e segurança" />  |

<sub>Prints do app em tamanho de celular (390 × 844), com contas fictícias de teste. Toque em uma imagem para ver em tamanho real.</sub>

### Jornada principal do cidadão

1. **Cria a conta** e vê as permissões. O GPS é opcional e só liga quando a pessoa toca no botão.
2. **Cadastra o PIN** e o primeiro contato de confiança.
3. **Busca o destino** em endereços reais de São Paulo e **compara as rotas a pé**. Os últimos destinos ficam salvos no aparelho.
4. **Escolhe quem acompanha** e inicia a caminhada. O contato recebe o link de acompanhamento.
5. **Durante o trajeto** tem SOS (segurar 3 s), aviso de bloqueio e "Cheguei ao destino". Encerrar exige o PIN.
6. **Relata um problema da rua**, como buraco, rua sem luz ou alagamento, e escolhe se envia ao painel da Prefeitura.

### Durante a caminhada: quem anda e quem acompanha

|                                                          Navegação                                                          |                                                      E-mail do contato                                                      |                                                    Contato acompanhando                                                     |                                               SOS ativo                                                |                                                    Contato vê o alerta                                                     |
| :-------------------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------: |
| <img src="docs/prints/mobile/11-navegacao-recalculada.jpg" width="165" alt="Navegação passo a passo na rota recalculada" /> | <img src="docs/prints/mobile/12-email-do-contato.jpg" width="165" alt="E-mail que o contato recebe ao iniciar o trajeto" /> | <img src="docs/prints/mobile/13-contato-acompanha.jpg" width="165" alt="Página de acompanhamento com a rota recalculada" /> | <img src="docs/prints/mobile/14-sos-ativo.jpg" width="165" alt="Tela de alerta ativo depois do SOS" /> | <img src="docs/prints/mobile/15-contato-ve-alerta.jpg" width="165" alt="Contato vê que a pessoa pode precisar de ajuda" /> |

- **Navegação:** instruções de cada virada, com semáforos e registros do trecho à frente. Se a pessoa sai do caminho, o app confirma o desvio com o GPS e calcula uma rota nova até o mesmo destino.
- **E-mail real:** ao iniciar, cada contato escolhido recebe um e-mail com o botão "Acompanhar trajeto". O link vale só durante o trajeto (no máximo 2 horas) e é revogado no servidor.
- **Quem acompanha** vê o roteiro, a previsão de chegada, a última posição recebida e o histórico ("Rota recalculada às 21:48"). Se o SOS for acionado, a mesma página mostra o alerta.

### Perfil Idoso/PCD

<img src="docs/prints/mobile/16-perfil-idoso-pcd.jpg" width="165" alt="Escolha do perfil de caminhada Idoso ou PCD" align="left" />
<img src="docs/prints/mobile/17-rota-perfil-pcd.jpg" width="165" alt="Rotas calculadas com o perfil Idoso/PCD" align="left" />

&nbsp;&nbsp;O perfil de caminhada muda o cálculo das rotas a pé:

- **Idoso ou PCD:** ritmo mais calmo e caminhos **sem escadas e sem ladeiras**, mesmo que fiquem mais longos. Buracos e calçadas ruins com chamado no SP156 pesam mais na comparação das rotas.
- **Cadeirante:** um modo próprio no planejamento, que evita degraus.
- **Criança:** prefere calçadas e caminhos de pedestre.
- **À noite:** prefere vias com iluminação mapeada.

O app avisa que isso usa dados do OpenStreetMap e da Prefeitura e **não certifica** a acessibilidade do caminho.

<br clear="left" />

<a id="painel-da-prefeitura"></a>

## 🏛️ Painel da Prefeitura

O relato do cidadão não fica só no app. Quando a pessoa escolhe enviar, ele cai na fila do **Painel da Prefeitura** (`apps/admin`), um app web separado onde o operador prioriza, vê no mapa e registra o andamento. A pessoa acompanha cada mudança pelo app. O painel **nunca recebe** o nome, o e-mail nem o identificador de quem relatou.

<img src="docs/prints/painel/02-fila-de-relatos.jpg" alt="Fila de relatos do Painel da Prefeitura com mapa de calor dos pontos críticos" width="100%" />

<sub>Fila de relatos: os relatos em aberto em ordem de prioridade sugerida, o mapa com os pontos onde vários relatos se repetem e os indicadores do dia.</sub>

|                                                        Um relato aberto                                                         |                                                                De perto                                                                |
| :-----------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------: |
| <img src="docs/prints/painel/03-detalhe-do-relato.jpg" width="560" alt="Relato de rua sem luz aberto no painel, com mapa 3D" /> | <img src="docs/prints/painel/04-detalhe-de-perto.jpg" width="240" alt="Detalhe do relato: andamento, local, prioridade e histórico" /> |

<img src="docs/prints/painel/05-visao-geral.jpg" alt="Visão geral do painel com gráficos de relatos recebidos e resolvidos" width="100%" />

<sub>Visão geral: relatos recebidos e resolvidos por dia, divisão por andamento, relatos em aberto por tipo e os pontos críticos.</sub>

| O que o operador faz     | Como                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **Prioriza a fila**      | Regra fixa e explicada na tela ("8 relatos em aberto do mesmo tipo a até 100 m"). É só uma sugestão, a equipe decide.            |
| **Vê no mapa**           | Mapa com pontos agrupados, mapa de calor dos pontos críticos e visão 3D do quarteirão.                                           |
| **Registra o andamento** | Recebido → Em análise → Equipe acionada → Resolvido (ou Arquivado), com uma nota. Tudo fica no histórico com o nome do operador. |
| **Filtra e exporta**     | Busca por endereço ou descrição, filtro por tipo e andamento, exportação em CSV.                                                 |
| **Recebe ao vivo**       | A fila se atualiza sozinha e mostra um aviso quando chega relato novo.                                                           |
| **Entra com segurança**  | Conta de operador ou só leitura, senha com hash, "Esqueci minha senha" por e-mail e sessão que acaba ao fechar a aba.            |

<img src="docs/prints/painel/01-entrar.jpg" alt="Tela de entrada do Painel da Prefeitura" width="100%" />

> O painel é uma **demonstração**: não há integração com o SP156 nem canal oficial da Prefeitura, e a tela deixa isso claro.

## ✅ Entrega de Mobile Development & IoT

| Critério                  | Como o SafeWalk atende                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Telas e navegação**     | Expo Router com rotas em arquivo (`apps/mobile/src/app`): 5 abas (Início, Rotas, Relatar, Contatos, Segurança), telas empilhadas e rotas dinâmicas como `trajeto/[id]` e `acompanhar/[token]`.                                                   |
| **Consumo de dados**      | API REST própria, consumida com TanStack Query (cache, carregamento e erro em todas as telas). A API consulta GeoSampa, SP156, Open-Meteo, CGE, Photon (endereços) e Valhalla (rotas a pé). Respostas validadas com zod.                         |
| **Banco de dados**        | **No servidor:** MariaDB com 24 migrações versionadas. **No aparelho:** SQLite (`expo-sqlite`) com os destinos recentes, que aparecem mesmo sem internet, e a sessão no `expo-secure-store`. Detalhes em [Banco de dados](#-banco-de-dados).     |
| **Acessibilidade**        | Rótulos, papéis e estados para leitor de tela em todos os controles, avisos falados (`accessibilityLiveRegion`), tema claro e escuro, "reduzir movimento", áreas de toque de 44 px ou mais, perfil Idoso/PCD e rota para cadeirante sem escadas. |
| **Aderência ao problema** | Toda a jornada sai do problema da Ficha: rota a pé com os registros do trajeto, contato de confiança acompanhando, SOS e relato à Prefeitura. Nenhum dado pessoal real é usado.                                                                  |
| **Documentação**          | Este README (Ficha, equipe, prints, como rodar), [detalhes técnicos](docs/detalhes-tecnicos.md), [arquitetura](docs/architecture.md), [roteiro do vídeo](docs/video-mobile.md) e [prompts de IA](prompts.md).                                    |

## 🤖 Entrega de IA & Machine Learning

**Pergunta:** quando um atropelamento acontece em São Paulo, ele tende a ter vítima grave ou fatal? O modelo usa a hora, o dia, o tipo de via, o local e os veículos envolvidos. Os dados são reais e públicos: **Infosiga / Detran-SP**, 29.410 sinistros com pedestre na capital, de 2019 a out/2026.

| Item                             | Onde                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| **Notebook executado**           | [`ml/safewalk_ml.ipynb`](ml/safewalk_ml.ipynb)                                       |
| **Relatório**                    | [`ml/RELATORIO_ML.md`](ml/RELATORIO_ML.md)                                           |
| **Dados (fonte, link, período)** | [`ml/dados/README.md`](ml/dados/README.md) · CSV processado em `ml/dados/processed/` |
| **Dependências**                 | [`ml/requirements.txt`](ml/requirements.txt)                                         |
| **Gráficos e tabelas**           | [`ml/figuras/`](ml/figuras)                                                          |

- **Modelo:** XGBoost.
- **Divisão:** treino com 2019–2024, teste com 2025–2026.
- **Busca:** 18 combinações de `max_depth`, `learning_rate` e `n_estimators`, com validação cruzada de 5 dobras só no treino.
- **Resultado no teste:** ROC-AUC 0,64 (baseline 0,50). Recupera 53% dos casos graves.
- **Para o cidadão:** à noite, 29% dos atropelamentos são graves ou fatais, contra 19% de dia. O escore entra no SafeWalk como prioridade de aviso, nunca como selo de rua segura.

## 📊 O projeto em números

| Item                           | Quantidade                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Aplicações                     | 3 (app Expo, API Node.js e Painel da Prefeitura) e 1 pacote de contratos compartilhado |
| Abas do app                    | 5 (Início, Rotas, Relatar, Contatos, Segurança)                                        |
| Fluxos de tela cobertos        | 52 ([cobertura de telas](docs/screen-coverage.md))                                     |
| Migrações do banco             | 24, versionadas em `database/`                                                         |
| Arquivos de teste automatizado | 34, rodando a cada envio no GitHub Actions                                             |
| Fontes de dados públicos       | GeoSampa, SP156, Infosiga, CGE, Open-Meteo, OpenStreetMap                              |
| Tipos de relato à Prefeitura   | 7 (buraco, semáforo, alagamento, rua sem luz, calçada, obra, passagem bloqueada)       |

## 🧭 Arquitetura

```mermaid
flowchart LR
  subgraph Celular["📱 Celular do cidadão"]
    APP["App Expo<br/>React Native + TypeScript"]
    LOCAL[("SQLite<br/>destinos recentes")]
    APP --> LOCAL
  end
  CONTATO["👤 Contato de confiança<br/>link de acompanhamento"]
  PAINEL["🏛️ Painel da Prefeitura<br/>React + Vite"]
  API["API Node.js<br/>Express + zod"]
  DB[("MariaDB<br/>24 migrações")]
  PUB["Dados públicos<br/>GeoSampa · SP156 · Open-Meteo · CGE"]
  GEO["Photon · Valhalla<br/>endereços e rotas a pé"]
  TILES["OpenFreeMap<br/>mapa"]

  APP -- "REST / JSON" --> API
  CONTATO -- "REST" --> API
  PAINEL -- "REST" --> API
  API --> DB
  API --> PUB
  API --> GEO
  APP --> TILES
```

| Pasta                | O que tem                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `apps/mobile`        | App Expo. `src/app` tem só as rotas; telas, hooks e serviços ficam em `src/features/<funcionalidade>`. |
| `apps/api`           | API Node/TypeScript: rota HTTP → service → repository → banco.                                         |
| `apps/admin`         | Painel da Prefeitura (React + Vite).                                                                   |
| `packages/contracts` | Schemas zod compartilhados entre app, API e painel.                                                    |
| `database`           | Migrações SQL do MariaDB.                                                                              |
| `docs`               | Decisões, fontes de dados, publicação, prints e imagens deste README.                                  |

## 🗄️ Banco de dados

O SafeWalk usa dois bancos, cada um com seu papel:

| Onde                   | Banco                  | O que guarda                                                                                                                                                     |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Servidor** (API)     | MariaDB, 26 tabelas    | Contas, PIN (hash), contatos e convites, trajetos, posições GPS, alertas, links de acompanhamento, relatos com foto, locais favoritos, cache dos dados públicos. |
| **Aparelho** (celular) | SQLite (`expo-sqlite`) | Os 8 últimos destinos escolhidos, separados por conta. Aparecem na busca na hora, mesmo sem internet.                                                            |

O banco local é criado e versionado pelo próprio app ([recent-destinations-store.ts](apps/mobile/src/features/places/recent-destinations-store.ts)):

```sql
CREATE TABLE recent_destinations (
  owner_id  TEXT NOT NULL,   -- conta dona do destino
  place_key TEXT NOT NULL,   -- ponto arredondado (~11 m): o mesmo lugar não se repete
  label     TEXT NOT NULL,
  latitude  REAL NOT NULL,
  longitude REAL NOT NULL,
  used_at   TEXT NOT NULL,   -- ISO 8601, UTC
  PRIMARY KEY (owner_id, place_key)
);
```

- **Gravar:** o destino entra por upsert e só os 8 mais recentes ficam, dentro de uma transação.
- **Ler:** os dados são validados com zod ao ler, e linhas corrompidas são descartadas.
- **Apagar:** dá para remover um destino ou limpar tudo pela tela.
- **Sair da conta:** sair ou excluir a conta apaga os destinos do aparelho.
- **Na web:** o SQLite exigiria cabeçalhos que bloqueiam o mapa, então os destinos ficam no `localStorage`, com as mesmas regras.

## 🎨 Identidade visual

<img src="docs/marca/safewalk-icone-1024.png" alt="Ícone do SafeWalk" width="96" align="right" />

O símbolo é um **S desenhado como um caminho**: começa num ponto âmbar (a saída) e termina num anel (o destino). As cores ficam centralizadas em [`apps/mobile/src/theme/tokens.ts`](apps/mobile/src/theme/tokens.ts) e o app usa as mesmas telas nos temas claro e escuro.

**Marca**

<img src="docs/readme/paleta-marca.svg" alt="Paleta da marca: Noite #0E1726, Creme #F5F3EC, Âmbar #F2B45A, Âmbar para fundo claro #E39A2C, Azul SafeWalk #2F6FEB, SOS #D92636" width="100%" />

**Tema claro**

<img src="docs/readme/paleta-claro.svg" alt="Paleta do tema claro" width="100%" />

**Tema escuro**

<img src="docs/readme/paleta-escuro.svg" alt="Paleta do tema escuro" width="100%" />

**Marcadores do mapa:** o símbolo é branco, e todos os fundos têm contraste de pelo menos 4,5:1 com o branco.

<img src="docs/readme/paleta-mapa.svg" alt="Cores dos marcadores do mapa" width="100%" />

**Tipografia:** [Inter](https://fonts.google.com/specimen/Inter) nos pesos 400, 500, 600, 700 e 800, carregada com `@expo-google-fonts/inter`.

## 🚀 Como rodar

**Mais rápido:** abra **https://safewalk.recapture.com.br/app** no navegador do celular.

**No computador** (Node 22.13+, npm e MariaDB na porta 3307):

```bash
npm install
npm run db:setup     # cria o banco e o usuário local
npm run db:migrate   # aplica as 24 migrações
npm run dev          # API em http://localhost:4010 e app em http://localhost:8081
```

**No celular, pelo Expo:** coloque o IP do computador em `apps/mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://<ip-do-computador>:4010
```

Depois rode:

```bash
npm run dev:mobile
```

O mapa nativo usa MapLibre, que não vem no Expo Go. Para ver o mapa no aparelho é preciso um development build (`npx expo run:android`). No Expo Go as outras telas funcionam e o mapa mostra esse aviso.

**Painel da Prefeitura:** `npm run dev:admin` abre em http://127.0.0.1:5190. Como criar o operador está em [detalhes técnicos](docs/detalhes-tecnicos.md#painel-da-prefeitura-demonstração).

## 🧪 Qualidade e publicação

```bash
npm run typecheck   # TypeScript strict em todos os pacotes
npm run lint
npm test            # testes da API, do painel e do app
```

Tudo que entra na `main` passa por typecheck, lint e testes no GitHub Actions. Se passar, vai sozinho para o servidor em até uns 10 minutos. O servidor busca a versão nova com uma chave somente leitura, então ninguém da equipe precisa de acesso à hospedagem. Como colaborar: [CONTRIBUTING.md](CONTRIBUTING.md).

**Dados com cuidado:**

- Nenhum dado pessoal real é usado. Os testes usam contas fictícias.
- Os dados urbanos são públicos, e o app mostra a fonte e a data de cada um.
- O GPS só é enviado durante um trajeto que a pessoa iniciou.

## 📚 Documentação

| Documento                                                                                                        | Assunto                                                              |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Detalhes técnicos](docs/detalhes-tecnicos.md)                                                                   | Fluxos, recursos de segurança, dados públicos, privacidade e limites |
| [Arquitetura](docs/architecture.md)                                                                              | Camadas, módulos e decisões                                          |
| [Cobertura de telas](docs/screen-coverage.md)                                                                    | Os 52 fluxos do protótipo                                            |
| [Dados urbanos](docs/urban-data.md), [busca e rotas](docs/routing-integration.md), [mapa](docs/map-rendering.md) | Fontes, importação e renderização                                    |
| [Hospedagem](docs/valuehost.md)                                                                                  | Publicação na ValueHost                                              |
| [Roteiro do vídeo](docs/video-mobile.md)                                                                         | Vídeo de 3 minutos da entrega de Mobile                              |
| [Prompts de IA](prompts.md)                                                                                      | Como a IA foi usada como copiloto                                    |

<div align="center">
<sub>SafeWalk · Global Solution FIAP 2026.2 · Engenharia de Software</sub>
</div>
