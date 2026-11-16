-- Fila de avisos automáticos de alerta aos contatos (hoje somente e-mail).
-- Uma linha por contato e por episódio de alerta (alert_started_at): a chave única torna o
-- enfileiramento idempotente. O worker envia fora da transação e registra o resultado.
-- 'accepted_by_relay' significa que o servidor SMTP aceitou a mensagem, não que ela foi lida.
CREATE TABLE IF NOT EXISTS contact_alert_messages (
  id CHAR(36) PRIMARY KEY,
  trip_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NOT NULL,
  channel VARCHAR(8) NOT NULL DEFAULT 'email',
  reason VARCHAR(16) NOT NULL,
  alert_started_at DATETIME(3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(3) NOT NULL,
  lease_until DATETIME(3) NULL,
  accepted_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_alert_message_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_message_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  UNIQUE KEY ux_alert_message_episode (trip_id, contact_id, channel, alert_started_at),
  INDEX ix_alert_message_due (status, next_attempt_at)
) ENGINE=InnoDB;
