# Prompts de IA

As regras da GS permitem usar IA como copiloto, desde que os prompts sejam registrados e a equipe saiba explicar cada parte do código. Usamos o Claude Code (Anthropic) para escrever, revisar e testar o código. Todo trecho gerado passou por typecheck, lint e testes antes de entrar na `main`.

Abaixo estão os principais pedidos, resumidos e agrupados por tema. Cada integrante acrescenta os próprios prompts na seção do seu nome.

## Publicação e infraestrutura

- "Subir o SafeWalk em safewalk.recapture.com.br, com a API em api.safewalk e o painel em painel.safewalk, numa conta separada da hospedagem."
- "Quando alguém alterar no GitHub, quero que o servidor atualize sozinho, sem dar acesso ao servidor para os colegas." Resultado: GitHub Actions testa e publica a branch `release`, e o servidor busca a versão nova com uma chave somente leitura.

## Contas e segurança

- "Fazer o 'Esqueci minha senha' com SMTP, igual aos meus outros projetos, no app e no painel." Resultado: link de uso único, válido por 30 minutos, guardado só como hash.

## Telas e experiência

- "Melhorar a tela de login do painel da Prefeitura: visualmente perfeita no celular e no computador, com ícones e efeitos, tudo bem profissional."
- "Colocar na apresentação um menu hambúrguer com os links do app, do painel administrativo e do que mais tiver."
- "As telas da apresentação ficaram cortadas no celular, melhorar a rolagem."

## Testes

- "Testar tudo, criando uma conta fictícia. Os colegas disseram que buscar o endereço estava difícil (precisaram clicar várias vezes) e que um não conseguiu abrir a apresentação." Resultado: ativar o mapa passou de 4 toques mais uma rolagem para 1 toque, e o endereço principal passou a abrir a apresentação direto pelo servidor.

## Entrega

- "Organizar a entrega de Mobile conforme o PDF da GS." Resultado: Ficha da CitizenTech e prints no README, roteiro do vídeo e este arquivo.

## Prompts de cada integrante

_Cada integrante cola aqui os prompts que usou e o que aprendeu com a resposta._
