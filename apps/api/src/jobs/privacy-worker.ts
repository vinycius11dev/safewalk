import { pruneExpiredHistory } from '../modules/auth/privacy.repository.js';

export function startPrivacyWorker(): () => void {
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await pruneExpiredHistory();
    } catch {
      console.error('Não foi possível aplicar o prazo de retenção dos dados.');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(
    () => {
      void tick();
    },
    60 * 60 * 1000,
  );
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
