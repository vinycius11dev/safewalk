import type { ReactNode } from 'react';

export type IconName =
  | 'mail'
  | 'mail-check'
  | 'lock'
  | 'key'
  | 'eye'
  | 'eye-off'
  | 'shield'
  | 'list'
  | 'map'
  | 'history'
  | 'arrow-left'
  | 'alert'
  | 'check';

/** Ícones de traço 24x24 do painel; a cor vem de `currentColor`. */
const paths: Record<IconName, ReactNode> = {
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7.5 8.5 5.8 8.5-5.8" />
    </>
  ),
  'mail-check': (
    <>
      <path d="M21 12V7.5A2.5 2.5 0 0 0 18.5 5h-13A2.5 2.5 0 0 0 3 7.5v9A2.5 2.5 0 0 0 5.5 19H13" />
      <path d="m3.5 7.5 8.5 5.8 8.5-5.8" />
      <path d="m16 19 2 2 4-4.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 15v2" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.7 6.7C4 8.5 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.9-1.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.7 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.8 7.5-9.5V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  list: (
    <>
      <path d="M10 6.5h10M10 12h10M10 17.5h10" />
      <path d="m3.5 6.5 1.3 1.3 2.2-2.6M3.5 12l1.3 1.3 2.2-2.6M3.5 17.5l1.3 1.3 2.2-2.6" />
    </>
  ),
  map: (
    <>
      <path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2" />
      <path d="M3.5 4.5V9H8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  'arrow-left': <path d="M19 12H5.5M11 6l-6 6 6 6" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.2M12 16.3v.2" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.2 12.2 2.6 2.6 5-5.6" />
    </>
  ),
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
