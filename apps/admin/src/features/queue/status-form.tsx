import { useState } from 'react';
import type { FormEvent } from 'react';
import { governmentStatusLabels } from '@safewalk/contracts';
import type { GovernmentStatus } from '@safewalk/contracts';
import { useChangeStatus } from '../../api/queries';

const NOTE_MAX = 500;
const openChoices: GovernmentStatus[] = ['analyzing', 'dispatched', 'resolved', 'dismissed'];

const choiceLabel = (status: GovernmentStatus, current: GovernmentStatus): string =>
  current === 'resolved' || current === 'dismissed'
    ? 'Reabrir o caso'
    : status === 'dismissed'
      ? 'Arquivar'
      : governmentStatusLabels[status];

/** Registra o andamento do caso. O histórico guarda quem mudou, de qual para qual estado e a nota. */
export function StatusForm({ id, current }: { id: string; current: GovernmentStatus }) {
  const closed = current === 'resolved' || current === 'dismissed';
  const choices = closed ? (['received'] as GovernmentStatus[]) : openChoices;
  const [choice, setChoice] = useState<GovernmentStatus | null>(null);
  const [note, setNote] = useState('');
  const change = useChangeStatus(id);
  const noteRequired = choice === 'dismissed';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!choice || (noteRequired && note.trim().length === 0)) return;
    change.mutate({ status: choice, note: note.trim() });
  };

  return (
    <form className="detail-block status-form" onSubmit={submit}>
      <h3>Registrar andamento</h3>
      <div className="choice-row" role="group" aria-label="Novo andamento">
        {choices
          .filter((status) => status !== current)
          .map((status) => (
            <button
              key={status}
              type="button"
              className={`choice status-${status}`}
              aria-pressed={choice === status}
              onClick={() => setChoice(status)}
            >
              {choiceLabel(status, current)}
            </button>
          ))}
      </div>
      {choice && (
        <>
          <label className="field">
            <span>
              {noteRequired
                ? 'Motivo do arquivamento (obrigatório)'
                : 'Nota para o histórico (opcional)'}
            </span>
            <textarea
              className="input"
              value={note}
              maxLength={NOTE_MAX}
              placeholder={
                noteRequired
                  ? 'Ex.: endereço não existe, relato duplicado de outro protocolo'
                  : 'Ex.: vistoria agendada para amanhã'
              }
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={change.isPending || (noteRequired && note.trim().length === 0)}
          >
            {change.isPending ? 'Registrando…' : 'Registrar'}
          </button>
        </>
      )}
      {change.isError && (
        <p className="notice notice-error small" role="alert">
          {change.error.message}
        </p>
      )}
    </form>
  );
}
