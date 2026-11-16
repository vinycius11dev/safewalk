import type { TripAlertReason } from '@safewalk/contracts';
import type { SafeWalkEmail } from '../../integrations/email/smtp.js';

const SAO_PAULO_TIME = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});

function whatHappened(name: string, reason: TripAlertReason): string[] {
  if (reason === 'manual') return [`${name} pediu ajuda pelo botão SOS do SafeWalk.`];
  if (reason === 'duress')
    return [
      `${name} enviou um sinal discreto de perigo pelo SafeWalk.`,
      'A pessoa pode estar acompanhada de quem a ameaça. Ao entrar em contato, não mencione este aviso.',
    ];
  if (reason === 'signal_lost')
    return [`O celular de ${name} parou de enviar a localização e o check-in não foi respondido.`];
  return [`${name} não respondeu ao check-in do trajeto acompanhado pelo SafeWalk.`];
}

export function contactAlertEmail(input: {
  to: string;
  travelerName: string;
  reason: TripAlertReason;
  url: string;
  linkExpiresAt: Date;
}): SafeWalkEmail {
  const name = input.travelerName.trim().split(/\s+/)[0] || 'Uma pessoa de confiança';
  return {
    to: input.to,
    subject: 'Alerta do SafeWalk: confira agora',
    text: [
      ...whatHappened(name, input.reason),
      '',
      'Abra o acompanhamento para ver a última posição enviada e confirmar que você viu o alerta:',
      input.url,
      '',
      'Se houver risco imediato, ligue 190 (Polícia Militar). O SafeWalk não aciona a polícia, a GCM nem câmeras.',
      '',
      `O link vale até ${SAO_PAULO_TIME.format(input.linkExpiresAt)} (horário de Brasília). Qualquer pessoa com o link pode ver a posição. Não encaminhe esta mensagem.`,
      '',
      'SafeWalk',
    ].join('\n'),
  };
}
