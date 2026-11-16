# Desenvolvimento

## Antes de mudar código

1. Leia o AGENTS da raiz e do aplicativo alterado.
2. Localize a tela/fluxo correspondente em `docs/prototype-map.md`.
3. Confira a documentação da versão instalada das dependências.
4. Para regras novas, defina entrada, saída, autorização e estados de falha antes da interface.

## Convenções

- Funcionalidades em `features/<nome>` no app e `modules/<nome>` na API.
- Componentes e telas em arquivos próprios; estilos em `<nome>.styles.ts`.
- Contratos compartilhados em `packages/contracts`. Não duplicar schemas entre API e aplicativo.
- Nomes de código em inglês; textos de produto em português. Instantes em UTC e rótulos de tempo em `pt-BR`, fuso de São Paulo.
- Evitar comentários que repetem o código. Registrar motivos, invariantes e limitações reais.
- Não criar abstrações genéricas para uma única necessidade. Extrair componentes quando representam a mesma responsabilidade.

## Verificação

Rode `npm run check` e o build da plataforma alterada. Para regras de API que envolvam persistência, rode os testes de integração locais. Revise as telas alteradas em 390 × 844 (referência) e em uma largura menor, verificando rolagem e foco do teclado.

Nenhuma alteração fica pronta com lint/typecheck quebrados. Novos dados externos devem ser validados. Não desabilitar regras para ocultar um erro de arquitetura ou estilo.

## Mudanças de banco

Migrações aplicadas nunca são editadas. Crie um próximo arquivo numerado. O runner confere checksum e a execução é explícita. Queries usam parâmetros e pertencem a repositories/infraestrutura. Dados pessoais e tokens não vão para logs ou fixtures versionadas.

## Revisão e commits

Prefira mudanças pequenas, com a mesma finalidade. Sugestões de mensagem: `feat(routes): add route comparison`, `fix(alerts): revoke completed trip links`, `refactor(ui): extract shared card styles`.

A revisão deve informar telas alteradas, comportamento implementado, verificações executadas e integrações que continuam simuladas. Alterações visuais devem citar a referência e apresentar uma captura atual.

## GitHub e publicação automática

A branch `main` é o que está no ar: tudo que entra nela é testado e publicado sozinho em
https://safewalk.recapture.com.br (app), https://painel.safewalk.recapture.com.br (painel da
Prefeitura) e https://api.safewalk.recapture.com.br (API), em até uns 10 minutos.

1. Crie uma branch a partir da `main` (`feature/nome-curto` ou `fix/nome-curto`).
2. Antes de enviar, rode `npm run typecheck`, `npm run lint` e `npm test`.
3. Abra um Pull Request para a `main`. O GitHub roda a mesma verificação (tipos, lint e testes).
4. Depois da revisão e com a verificação verde, a mudança entra na `main` e vai para o ar.

Se a verificação falhar, nada é publicado e o servidor continua com a versão anterior. Ninguém
precisa de acesso à hospedagem: o servidor busca as versões publicadas sozinho (detalhes em
`docs/valuehost.md`). Nunca envie `.env`, senhas, tokens ou dados pessoais ao repositório.
