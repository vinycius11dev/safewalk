import type { TripAlertReason } from '@safewalk/contracts';
import { brandedEmailLayout, escapeHtml } from '../../integrations/email/layout.js';
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
  const happened = whatHappened(name, input.reason);
  const emergency =
    'Se houver risco imediato, ligue 190 (Polícia Militar). O SafeWalk não aciona a polícia, a GCM nem câmeras.';
  const expiry = `O link vale até ${SAO_PAULO_TIME.format(input.linkExpiresAt)} (horário de Brasília). Qualquer pessoa com o link pode ver a posição. Não encaminhe esta mensagem.`;
  return {
    to: input.to,
    subject: 'Alerta do SafeWalk: confira agora',
    text: [
      ...happened,
      '',
      'Abra o acompanhamento para ver a última posição enviada e confirmar que você viu o alerta:',
      input.url,
      '',
      emergency,
      '',
      expiry,
      '',
      'SafeWalk',
    ].join('\n'),
    html: brandedEmailLayout({
      eyebrow: 'Alerta de trajeto',
      title: `${name} pode precisar de ajuda`,
      paragraphs: [
        ...happened.map(escapeHtml),
        'Abra o acompanhamento para ver a última posição enviada e confirmar que você viu o alerta.',
        `<strong style="color:#b42318;">${escapeHtml(emergency)}</strong>`,
      ],
      action: { label: 'Ver alerta agora', url: input.url, tone: 'danger' },
      footer: expiry,
    }),
  };
}
