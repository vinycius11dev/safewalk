# API SafeWalk

- Seguir o AGENTS da raiz. Usar ESM com imports relativos terminados em `.js` (NodeNext).
- Queries somente em `*.repository.ts` e infraestrutura do banco; sempre com parâmetros.
- Validar entrada HTTP com Zod; identificar usuário pelo token, nunca pelo corpo enviado pelo cliente.
- Erros de negócio usam `AppError`; detalhes internos não vão para a resposta HTTP.
- Usuário root proibido em execução. Pool limitado e transações com rollback/liberação em `finally`.
- Migrações incrementais, versionadas e explícitas. Não apagar tabelas automaticamente.
- Processador de alertas usa estado e prazos no banco; transições condicionais evitam avisos duplicados.
- Não enviar mensagens reais na demonstração. Identificar eventos de integração simulada.
