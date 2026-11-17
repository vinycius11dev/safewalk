import { governmentStatusLabels } from '@safewalk/contracts';
import type { GovernmentStatus } from '@safewalk/contracts';
import { Icon } from '../../shared/icons';

const steps: GovernmentStatus[] = ['received', 'analyzing', 'dispatched', 'resolved'];

type StepState = 'passed' | 'skipped' | 'current' | 'ahead' | 'off';

type Props = {
  status: GovernmentStatus;
  /** Andamentos que constam no histórico; indefinido enquanto o histórico não chegou. */
  visited?: ReadonlySet<GovernmentStatus>;
};

/**
 * Trilha do caso: Recebido, Em análise, Equipe acionada, Resolvido, com a etapa atual acesa.
 * Só ganha o visto a etapa que consta no histórico: um caso pode ir de Recebido direto a
 * Equipe acionada. Arquivado não é etapa do caminho e aparece à parte, como caso encerrado.
 */
export function CaseTrack({ status, visited }: Props) {
  const archived = status === 'dismissed';
  const current = steps.indexOf(status);
  const stateOf = (step: GovernmentStatus, index: number): StepState => {
    if (archived) return 'off';
    if (index === current) return 'current';
    if (index > current) return 'ahead';
    return step === 'received' || visited?.has(step) ? 'passed' : 'skipped';
  };
  return (
    <div className={`track status-${status}`} data-archived={archived ? 'true' : undefined}>
      <ol className="track-steps" aria-label="Andamento do caso">
        {steps.map((step, index) => {
          const state = stateOf(step, index);
          return (
            <li
              key={step}
              className="track-step"
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="track-dot" aria-hidden="true">
                {state === 'passed' || (state === 'current' && step === 'resolved') ? (
                  <Icon name="tick" />
                ) : null}
              </span>
              <span className="track-label">
                {governmentStatusLabels[step]}
                {state === 'skipped' && (
                  <span className="sr-only"> (sem registro no histórico)</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {archived && (
        <p className="track-ended">
          <Icon name="archive" />
          <span>
            <strong>{governmentStatusLabels.dismissed}.</strong> O caso foi encerrado sem ser
            resolvido; o motivo está no histórico.
          </span>
        </p>
      )}
    </div>
  );
}
