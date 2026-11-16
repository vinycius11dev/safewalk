# Painel da Prefeitura (demonstração)

- Seguir o AGENTS da raiz. É um aplicativo web separado do app do cidadão: nunca importa de `apps/mobile`.
- Todo dado vem da API (`/api/admin`) e é validado com os schemas de `@safewalk/contracts`. Telas não usam `fetch`: use `src/api`.
- CSS em arquivos `.css`, sem objetos `style` no JSX. Cores e espaços são variáveis de `src/styles/tokens.css`; cor por tipo de relato, classes `type-*`.
- Sempre dizer que é demonstração: nada aqui é protocolo oficial da Prefeitura ou do SP156, e o andamento só muda quando um operador registra.
- Nunca exibir dado pessoal de quem relatou: a API não envia e a tela não deve pedir.
