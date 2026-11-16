import { advanceDueAlerts } from './alerts.repository.js';
import { processContactAlerts } from '../modules/contact-alerts/contact-alerts.service.js';

export function startAlertWorker(): () => void {
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await advanceDueAlerts();
    } catch {
      console.error('Não foi possível processar os prazos dos alertas.');
    }
    try {
      await processContactAlerts();
    } catch {
      console.error('Não foi possível processar os avisos de alerta aos contatos.');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => {
    void tick();
  }, 5000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
