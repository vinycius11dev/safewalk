-- O titular escolheu avisar os contatos deste trajeto que há uma pessoa em cadeira de rodas.
-- Falso por padrão: é dado sensível e só aparece no link com a escolha explícita.
ALTER TABLE trips ADD COLUMN wheelchair_shared BOOLEAN NOT NULL DEFAULT FALSE;
