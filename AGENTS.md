# SafeWalk: regras de desenvolvimento

## Produto e referência

- Manter textos, hierarquia, cores e fluxos do protótipo SafeWalk. Alterações de produto devem ser documentadas em `docs/prototype-map.md`.
- Smart Sampa, GCM, SP156, notificações externas e risco de exemplo devem ser identificados como simulação enquanto não houver integração validada.
- Nunca mostrar atendimento confirmado, entrega de mensagem ou localização atual sem evidência do serviço responsável.
- Toda tela deve prever carregamento, erro, ausência de dados e permissões negadas quando aplicável.

## Estrutura e dependências

- `apps/mobile`: Expo/React Native e experiências web; `apps/api`: API Node/TypeScript; `packages/contracts`: validações e contratos compartilhados; `database`: migrações; `docs`: decisões.
- `src/app` contém somente rotas e layouts do Expo Router. Telas, hooks e serviços ficam em `src/features/<feature>`.
- Interface não acessa SQL ou credenciais. Componentes visuais não executam `fetch`: use serviços/hooks da funcionalidade.
- Backend: rota HTTP -> service -> repository -> banco. SQL parametrizado somente em repositories e infraestrutura do banco.
- Compartilhar código que tem o mesmo significado, sem camadas genéricas antecipadas. Evitar dependências circulares e importações profundas entre funcionalidades.

## Estilos separados

- Estilos nativos em `<component>.styles.ts`, com `StyleSheet.create`. Nenhum `StyleSheet.create` dentro de `.tsx`.
- Sem objetos de estilo inline em JSX. Valores que dependem de estado/tema são resolvidos por funções no arquivo de estilos.
- CSS exclusivo do navegador em `.css`/`.module.css`, fora do JSX. Não usar CSS do navegador como dependência de componente nativo.
- Cores, espaços, bordas e tipografia centralizados em `src/theme`. Usar cores semânticas, evitando valores duplicados nas telas.
- Claro e escuro usam os mesmos componentes e tokens. Respeitar áreas seguras, teclado, fonte ampliada e contraste.

## TypeScript, React e API

- TypeScript `strict`, sem `any`, sem `@ts-ignore` para silenciar erros. Validar dados externos com os schemas compartilhados.
- Funções e componentes com uma responsabilidade. Componentes React em PascalCase; arquivos/pastas em kebab-case; hooks começam com `use`.
- Efeitos têm limpeza; operações assíncronas tratam erro e desmontagem. Não sincronizar estado derivável por efeito.
- Dinheiro/tempo/unidades têm nomes explícitos. Instantes persistidos em UTC, apresentação em `America/Sao_Paulo`.
- Erros HTTP possuem código estável; mensagens internas e segredos não vão para o cliente.
- Credenciais em `.env` ignorado. Apenas configurações públicas em `EXPO_PUBLIC_*`. Sem tokens ou coordenadas pessoais em logs.
- Autorização no servidor por recurso. PIN armazenado como hash, com limitação de tentativas. Links de acompanhamento têm token aleatório, prazo e revogação no servidor.
- Transições do SOS e encerramento do trajeto devem ser atômicas e idempotentes. Prazos persistidos no banco, nunca somente em `setTimeout` do celular.

## Qualidade e entrega

- Seguir os AGENTS adicionais de cada aplicativo. Conferir a documentação da versão instalada antes de usar API de framework.
- Rodar typecheck, lint, testes das regras alteradas e build relevante. Não criar testes que apenas repetem detalhes de implementação.
- Não ignorar falha de dependência ou substituir silenciosamente o banco por dados em memória.
- Atualizar README e decisões quando comandos, arquitetura ou comportamento mudarem.
- Não publicar, reiniciar ou alterar aplicações existentes na ValueHost durante trabalho local sem escopo específico para isso.

## graphify

- Quando o usuário invocar `/graphify`, seguir a skill instalada antes de outras ações.
