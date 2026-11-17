import type { TripMode } from '@safewalk/contracts';

/**
 * Smart Sampa and the GCM are not integrated. Their simulated steps belong only to the guided
 * demonstration: a demo-mode trip or any trip of the demo account. A real account on a real trip
 * never records or reads them.
 */
export const usesSimulatedIntegrations = (trip: { mode: TripMode; ownerIsDemo: boolean }): boolean =>
  trip.mode === 'demo' || trip.ownerIsDemo;

/**
 * Event recorded when the escalation deadline passes without any contact confirming the alert.
 * Only the demonstration names the GCM; a real trip records just the fact.
 */
export const unansweredAlertEvent = (simulatedIntegrations: boolean): string =>
  simulatedIntegrations ? 'gcm_escalation_simulated' : 'alert_unanswered_by_contacts';
