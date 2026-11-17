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
  | 'check'
  | 'search'
  | 'close'
  | 'chevron-right'
  | 'download'
  | 'pin'
  | 'clock'
  | 'stack'
  | 'camera'
  | 'flag'
  | 'gauge'
  | 'info'
  | 'external'
  | 'archive'
  | 'logout'
  | 'tick';

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
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  'chevron-right': <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  download: (
    <>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  stack: (
    <>
      <path d="m12 4 8.5 4.5L12 13 3.5 8.5z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
    </>
  ),
  camera: (
    <>
      <path d="M4.5 8h3l1.5-2.5h6L16.5 8h3A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8z" />
      <circle cx="12" cy="13.3" r="3.2" />
    </>
  ),
  flag: <path d="M5.5 21V4.5h11l-2 4 2 4h-11" />,
  gauge: (
    <>
      <rect x="3.5" y="3.5" width="7" height="9" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="15.5" width="7" height="5" rx="1.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.2M12 7.6v.2" />
    </>
  ),
  external: (
    <>
      <path d="M13.5 5H19v5.5M19 5l-8 8" />
      <path d="M17 14.5V18a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V9a1.5 1.5 0 0 1 1.5-1.5H10" />
    </>
  ),
  archive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.2" />
      <path d="M5.5 9v9A1.5 1.5 0 0 0 7 19.5h10a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M4.5 12H14M10 8l4 4-4 4" />
    </>
  ),
  tick: <path d="m5.5 12.5 4.2 4.2 8.8-9.4" />,
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
