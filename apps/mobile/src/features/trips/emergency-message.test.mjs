import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEmergencyMessage,
  normalizePhoneForWhatsApp,
  smsUrl,
  whatsAppUrl,
} from './emergency-message';

test('normalizePhoneForWhatsApp aceita celular brasileiro e preserva o 55', () => {
  assert.equal(normalizePhoneForWhatsApp('(11) 98765-4321'), '5511987654321');
  assert.equal(normalizePhoneForWhatsApp('11 3456-7890'), '551134567890');
  assert.equal(normalizePhoneForWhatsApp('+55 11 98765-4321'), '5511987654321');
  assert.equal(normalizePhoneForWhatsApp('5511987654321'), '5511987654321');
  assert.equal(normalizePhoneForWhatsApp('123'), null);
  assert.equal(normalizePhoneForWhatsApp('+1 202-555-0100'), null);
});

test('buildEmergencyMessage inclui o link e a última posição quando disponível', () => {
  const message = buildEmergencyMessage({
    travelerFirstName: 'Leo',
    url: 'https://safewalk.example/acompanhar/token-1',
    lastPosition: {
      latitude: -23.5644,
      longitude: -46.6522,
      accuracyMeters: 8,
      recordedAt: '2026-10-28T20:00:00.000Z',
      receivedAt: '2026-10-28T20:01:00.000Z',
    },
  });
  assert.match(message, /SOS SafeWalk: Leo acionou um alerta/);
  assert.match(message, /https:\/\/safewalk\.example\/acompanhar\/token-1/);
  assert.match(message, /Última posição recebida às \d{2}:\d{2}/);
  assert.match(
    message,
    /openstreetmap\.org\/\?mlat=-23\.5644&mlon=-46\.6522#map=18\/-23\.5644\/-46\.6522/,
  );
  const without = buildEmergencyMessage({
    travelerFirstName: 'Leo',
    url: 'https://safewalk.example/acompanhar/token-2',
    lastPosition: null,
  });
  assert.equal(without.includes('Última posição'), false);
});

test('deep links codificam a mensagem e usam o separador correto por plataforma', () => {
  const text = 'SOS SafeWalk: ajuda pelo link: https://x.test/a?b=1';
  assert.equal(
    whatsAppUrl('5511987654321', text),
    `https://wa.me/5511987654321?text=${encodeURIComponent(text)}`,
  );
  assert.match(smsUrl('+55 11 98765-4321', text, 'ios'), /^sms:\+5511987654321&body=/);
  assert.match(smsUrl('+55 11 98765-4321', text, 'android'), /^sms:\+5511987654321\?body=/);
  assert.match(smsUrl('+55 11 98765-4321', text, 'web'), /^sms:\+5511987654321\?body=/);
  assert.match(smsUrl('11 98765-4321', text, 'android'), /^sms:\+5511987654321\?body=/);
  assert.match(smsUrl('+1 202-555-0100', text, 'android'), /^sms:\+12025550100\?body=/);
});
