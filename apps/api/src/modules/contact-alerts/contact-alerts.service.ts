import {
  sendSafeWalkEmail,
  smtpConfigFromEnvironment,
  type SafeWalkEmail,
} from '../../integrations/email/smtp.js';
import { contactAlertEmail } from './alert-email.js';
import { claimDueContactAlerts, completeContactAlert } from './contact-alerts.repository.js';

/**
 * Sends the queued alert e-mails. Without SMTP (demo mode, local work) every message is marked
 * not_configured and nothing leaves the server. Delivery is at least once: if the process stops
 * after the relay accepted a message but before it was recorded, the message is sent again.
 */
export async function processContactAlerts(
  options: {
    sendEmail?: (message: SafeWalkEmail) => Promise<void>;
    configured?: boolean;
    /** Only this trip's messages (tests share the database with a running worker). */
    tripId?: string;
    /** Treats messages scheduled up to this instant as due. The default is the database clock. */
    dueBy?: Date;
  } = {},
): Promise<number> {
  const sendEmail = options.sendEmail ?? sendSafeWalkEmail;
  const configured = options.configured ?? smtpConfigFromEnvironment() !== null;
  const claimed = await claimDueContactAlerts(configured, {
    tripId: options.tripId,
    dueBy: options.dueBy,
  });
  await Promise.all(
    claimed.map(async (message) => {
      let accepted = false;
      try {
        await sendEmail(contactAlertEmail(message));
        accepted = true;
      } catch {
        // Recipient, relay and network errors are not logged: they may contain the address.
      }
      await completeContactAlert(message.id, message.attempts, accepted);
    }),
  );
  return claimed.length;
}
