import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SHARE_LINK_MIN_REISSUE_SECONDS,
  shareLinkReissueWaitSeconds,
} from './share-link-policy.js';
import { shareLinkState } from './trip-state.js';

const now = new Date('2026-01-01T12:00:00Z');

test('sem link anterior ou fora da janela, pode gerar', () => {
  assert.equal(shareLinkReissueWaitSeconds(null, now), 0);
  const old = new Date(now.getTime() - SHARE_LINK_MIN_REISSUE_SECONDS * 1000);
  assert.equal(shareLinkReissueWaitSeconds(old, now), 0);
});

test('dentro da janela informa os segundos restantes', () => {
  const recent = new Date(now.getTime() - 5_000);
  assert.equal(shareLinkReissueWaitSeconds(recent, now), SHARE_LINK_MIN_REISSUE_SECONDS - 5);
  assert.equal(shareLinkReissueWaitSeconds(now, now), SHARE_LINK_MIN_REISSUE_SECONDS);
});

test('links revogados pelo titular ou substituídos aparecem como expirados', () => {
  const expiresAt = new Date(now.getTime() + 3_600_000);
  for (const reason of ['owner_revoked', 'replaced'])
    assert.equal(shareLinkState(expiresAt, now, reason, 'active', now), 'expired');
  assert.equal(shareLinkState(expiresAt, now, 'owner_revoked', 'arrived', now), 'expired');
});
