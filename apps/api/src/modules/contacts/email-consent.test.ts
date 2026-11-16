import assert from 'node:assert/strict';
import test from 'node:test';
import { invitationDecisionSchema } from '@safewalk/contracts';
import {
  canPreserveEmailTripAlertConsent,
  hasEmailTripAlertConsent,
  maskContactEmail,
} from './email-consent.js';

test('invitation email consent is explicit, only on acceptance, and requires a stored address', () => {
  assert.equal(
    invitationDecisionSchema.parse({ accepted: true, consent: true }).emailTripAlerts,
    false,
  );
  assert.equal(hasEmailTripAlertConsent(true, true, 'trusted@example.com'), true);
  assert.equal(hasEmailTripAlertConsent(true, false, 'trusted@example.com'), false);
  assert.equal(hasEmailTripAlertConsent(false, true, 'trusted@example.com'), false);
  assert.equal(hasEmailTripAlertConsent(true, true, null), false);
});

test('the main invitation consent remains required before accepting', () => {
  assert.throws(() => invitationDecisionSchema.parse({ accepted: true, consent: false }));
  assert.throws(() =>
    invitationDecisionSchema.parse({ accepted: false, consent: false, emailTripAlerts: true }),
  );
  assert.equal(hasEmailTripAlertConsent(false, true, 'trusted@example.com'), false);
});

test('the public invitation only reveals a masked email address', () => {
  const masked = maskContactEmail('alexandra.person@example.com');
  assert.equal(masked, 'a••••••@e•••.com');
  assert.equal(masked?.includes('alexandra.person'), false);
  assert.equal(masked?.includes('example.com'), false);
  assert.equal(maskContactEmail(null), null);
});

test('email consent cannot be enabled by the owner or carried to a changed identity', () => {
  assert.equal(canPreserveEmailTripAlertConsent(false, true, true), true);
  assert.equal(canPreserveEmailTripAlertConsent(false, true, false), false);
  assert.equal(canPreserveEmailTripAlertConsent(false, false, true), false);
  assert.equal(canPreserveEmailTripAlertConsent(true, true, true), false);
});
