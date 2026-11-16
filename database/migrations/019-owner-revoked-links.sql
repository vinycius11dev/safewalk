-- Instante de emissão do link, usado para limitar a frequência de geração de novos links.
-- revoked_reason já é VARCHAR(24): 'owner_revoked' e 'replaced' não exigem alteração de tipo.
ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS issued_at DATETIME(3) NULL;
