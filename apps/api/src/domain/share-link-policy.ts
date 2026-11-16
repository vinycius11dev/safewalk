export const SHARE_LINK_MIN_REISSUE_SECONDS = 10;

export const SHARE_REVOKED_BY_OWNER = 'owner_revoked';

/** Segundos que ainda faltam para poder gerar novos links; 0 quando já pode. */
export function shareLinkReissueWaitSeconds(lastIssuedAt: Date | null, now: Date): number {
  if (lastIssuedAt === null) return 0;
  const elapsedMs = now.getTime() - lastIssuedAt.getTime();
  const remainingMs = SHARE_LINK_MIN_REISSUE_SECONDS * 1000 - Math.max(0, elapsedMs);
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}
