import type { ReactNode } from 'react';
import type { ReportType } from '@safewalk/contracts';

/** Símbolos 24x24 de traço, brancos sobre o fundo colorido do tipo (cores em tokens.css). */
const glyphs: Partial<Record<ReportType, ReactNode>> = {
  pothole: (
    <>
      <path d="M12 3 2.5 20h19z" />
      <path d="M12 10v4" />
      <path d="M12 17.2v.1" />
    </>
  ),
  traffic_light: (
    <>
      <rect x="8" y="2.5" width="8" height="19" rx="3" />
      <circle cx="12" cy="7.5" r="1.1" />
      <circle cx="12" cy="12" r="1.1" />
      <circle cx="12" cy="16.5" r="1.1" />
    </>
  ),
  flood: <path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3z" />,
  lighting: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
    </>
  ),
  sidewalk: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M11 6 9 10l3 2-2 6" />
    </>
  ),
  construction: (
    <>
      <path d="M12 3l5 16H7z" />
      <path d="M8.5 11h7M7 17h10M4 21h16" />
    </>
  ),
  obstruction: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
};

export function TypeGlyph({ type }: { type: ReportType }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyphs[type] ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}

export function TypeBadge({ type }: { type: ReportType }) {
  return (
    <span className={`type-badge type-${type}`}>
      <TypeGlyph type={type} />
    </span>
  );
}
