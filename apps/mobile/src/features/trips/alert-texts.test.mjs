import assert from 'node:assert/strict';
import test from 'node:test';
import { alertStatusText, checkinText, confirmationNotice } from './alert-texts';

const contact = '384b8375-36f1-4678-af7a-0eb55f0c385c';
const other = '7d0c2a43-9f0e-4c0b-8f43-0a4f6a0f7a11';
const simulationWords = /simula|demonstra|GCM|Smart Sampa|câmera/i;

test('trajeto real nunca fala em simulação no check-in, qualquer que seja o motivo', () => {
  const now = Date.parse('2026-11-08T17:00:00.000Z');
  for (const alertReason of ['late', 'stopped', 'deviation', 'signal_lost'])
    for (const expectedArrivalAt of ['2026-11-08T16:50:00.000Z', '2026-11-08T17:20:00.000Z'])
      assert.doesNotMatch(
        checkinText({ alertReason, mode: 'route', destination: 'Casa', expectedArrivalAt }, now, false),
        simulationWords,
      );
});

test('a demonstração continua dizendo que o atraso, o desvio e a parada foram simulados', () => {
  const now = Date.parse('2026-11-08T17:00:00.000Z');
  const trip = { mode: 'demo', destination: 'Casa', expectedArrivalAt: '2026-11-08T17:20:00.000Z' };
  for (const alertReason of ['late', 'stopped', 'deviation'])
    assert.match(checkinText({ ...trip, alertReason }, now, true), /simulad/);
});

test('alerta ativo diz desde quando e quem vê, sem citar integrações que não existem', () => {
  const text = alertStatusText({
    contactIds: [contact, other],
    alertStartedAt: '2026-11-08T17:02:00.000Z',
  });
  assert.match(text, /Ativo desde as 14:02/);
  assert.match(text, /Seus contatos veem/);
  assert.doesNotMatch(text, simulationWords);
  assert.match(alertStatusText({ contactIds: [contact], alertStartedAt: null }), /^Seu contato vê/);
});

test('sem contatos no trajeto, o texto não promete aviso a ninguém e indica o 190', () => {
  const text = alertStatusText({ contactIds: [], alertStartedAt: null });
  assert.match(text, /ninguém foi avisado/);
  assert.match(text, /190/);
});

test('só afirma confirmação de contato quando o servidor informou', () => {
  const trip = { status: 'alerted', contactIds: [contact, other] };
  assert.equal(confirmationNotice({ ...trip, acknowledgedContactIds: null }), null);
  assert.equal(confirmationNotice({ ...trip, acknowledgedContactIds: undefined }), null);
  assert.equal(
    confirmationNotice({ status: 'escalated', contactIds: [], acknowledgedContactIds: [] }),
    null,
  );
  assert.match(confirmationNotice({ ...trip, acknowledgedContactIds: [] }).title, /Aguardando/);
  assert.match(
    confirmationNotice({ ...trip, acknowledgedContactIds: [contact] }).title,
    /1 contato confirmou/,
  );
});

test('prazo vencido sem confirmação sugere o 190 e não cita GCM', () => {
  const notice = confirmationNotice({
    status: 'escalated',
    contactIds: [contact],
    acknowledgedContactIds: [],
  });
  assert.equal(notice.title, 'Nenhum contato confirmou ainda');
  assert.match(notice.text, /ligue 190/);
  assert.doesNotMatch(`${notice.title} ${notice.text}`, simulationWords);
});
