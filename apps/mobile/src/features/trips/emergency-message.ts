import type { PositionInput } from '@safewalk/contracts';
import { localTime } from '@/lib/time';

export function normalizePhoneForWhatsApp(phone: string): string | null {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  const normalized = digits.startsWith('00') ? digits.slice(2) : digits;
  if (normalized.length >= 12 && normalized.length <= 13 && normalized.startsWith('55')) {
    return normalized;
  }
  const explicitCountryCode = trimmed.startsWith('+') || digits !== normalized;
  if (!explicitCountryCode && digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }
  return null;
}
export function buildEmergencyMessage({
  travelerFirstName,
  url,
  lastPosition,
}: {
  travelerFirstName: string;
  url: string;
  lastPosition: (PositionInput & { receivedAt: string }) | null;
}): string {
  const base = `SOS SafeWalk: ${travelerFirstName} acionou um alerta e pode precisar de ajuda. Acompanhe pelo link: ${url}`;
  if (!lastPosition) return base;
  const { latitude, longitude, receivedAt } = lastPosition;
  return `${base} Última posição recebida às ${localTime(receivedAt)}: https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;
}
export function whatsAppUrl(phoneDigits: string, text: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
}
export function smsUrl(phone: string, text: string, platform: 'ios' | 'android' | 'web'): string {
  const trimmed = phone.trim();
  const normalized = normalizePhoneForWhatsApp(trimmed);
  let recipient: string;
  if (normalized) {
    recipient = `+${normalized}`;
  } else {
    const raw = trimmed.replace(/\D/g, '');
    recipient = trimmed.startsWith('+') || raw.startsWith('00') ? `+${raw}` : raw;
  }
  const separator = platform === 'ios' ? '&' : '?';
  return `sms:${recipient}${separator}body=${encodeURIComponent(text)}`;
}
