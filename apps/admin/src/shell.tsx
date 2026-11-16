import { useState } from 'react';
import { adminRoleLabels } from '@safewalk/contracts';
import type { Coordinates, ReportType } from '@safewalk/contracts';
import { useSession } from './features/auth/session';
import { OverviewScreen } from './features/overview/overview-screen';
import { QueueScreen } from './features/queue/queue-screen';
import { SafeWalkMark } from './shared/safewalk-mark';
import './shell.css';

type Tab = 'queue' | 'overview';
/** Pedido para abrir a fila já num ponto crítico; `nonce` recria a fila a cada pedido. */
export type QueueFocus = { type: ReportType; location: Coordinates; nonce: number };

export function Shell() {
  const { state, signOut } = useSession();
  const [tab, setTab] = useState<Tab>('queue');
  const [focus, setFocus] = useState<QueueFocus | null>(null);
  if (state.status !== 'in') return null;
  const { user } = state;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <SafeWalkMark size={34} />
          <div>
            <strong>SafeWalk</strong>
            <span>Painel da Prefeitura</span>
          </div>
          <span className="demo-tag">Demonstração</span>
        </div>
        <nav className="topbar-nav" aria-label="Seções do painel">
          <button
            type="button"
            aria-current={tab === 'queue' ? 'page' : undefined}
            onClick={() => setTab('queue')}
          >
            Fila de relatos
          </button>
          <button
            type="button"
            aria-current={tab === 'overview' ? 'page' : undefined}
            onClick={() => setTab('overview')}
          >
            Visão geral
          </button>
        </nav>
        <div className="topbar-user">
          <div>
            <strong>{user.name}</strong>
            <span>{adminRoleLabels[user.role]}</span>
          </div>
          <button type="button" className="btn btn-quiet topbar-exit" onClick={signOut}>
            Sair
          </button>
        </div>
      </header>
      <p className="disclaimer">
        Painel de demonstração. Os relatos vêm de pessoas que escolheram enviá-los pelo app
        SafeWalk; não são protocolos oficiais da Prefeitura nem do SP156. O andamento só muda quando
        um operador registra.
      </p>
      <main className="shell-main">
        {tab === 'queue' ? (
          <QueueScreen key={focus?.nonce ?? 0} role={user.role} focus={focus} />
        ) : (
          <OverviewScreen
            onOpenHotspot={(type, location) => {
              setFocus({ type, location, nonce: Date.now() });
              setTab('queue');
            }}
          />
        )}
      </main>
    </div>
  );
}
