import { useState } from 'react';
import { adminRoleLabels } from '@safewalk/contracts';
import type { Coordinates, ReportType } from '@safewalk/contracts';
import { useSession } from './features/auth/session';
import { OverviewScreen } from './features/overview/overview-screen';
import { QueueScreen } from './features/queue/queue-screen';
import { Icon } from './shared/icons';
import { SafeWalkMark } from './shared/safewalk-mark';
import './shell.css';

type Tab = 'queue' | 'overview';
/** Pedido para abrir a fila já num ponto crítico; `nonce` recria a fila a cada pedido. */
export type QueueFocus = { type: ReportType; location: Coordinates; nonce: number };

/** Iniciais do operador para o círculo ao lado do nome. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export function Shell() {
  const { state, signOut } = useSession();
  const [tab, setTab] = useState<Tab>('queue');
  const [focus, setFocus] = useState<QueueFocus | null>(null);
  if (state.status !== 'in') return null;
  const { user } = state;

  return (
    <div className="shell" data-tab={tab}>
      <header className="topbar">
        <div className="topbar-brand">
          <SafeWalkMark size={32} />
          <div>
            <strong>SafeWalk</strong>
            <span>Painel da Prefeitura</span>
          </div>
        </div>
        <nav className="topbar-nav" aria-label="Seções do painel">
          <button
            type="button"
            aria-current={tab === 'queue' ? 'page' : undefined}
            onClick={() => setTab('queue')}
          >
            <Icon name="map" />
            Fila de relatos
          </button>
          <button
            type="button"
            aria-current={tab === 'overview' ? 'page' : undefined}
            onClick={() => setTab('overview')}
          >
            <Icon name="gauge" />
            Visão geral
          </button>
        </nav>
        <p className="demo-note">
          <Icon name="info" />
          <span>
            <strong>Painel de demonstração.</strong> Os relatos vêm de pessoas que escolheram
            enviá-los pelo app SafeWalk; não são protocolos oficiais da Prefeitura nem do SP156. O
            andamento só muda quando um operador registra.
          </span>
        </p>
        <div className="topbar-user">
          <span className="topbar-avatar" aria-hidden="true">
            {initialsOf(user.name)}
          </span>
          <div>
            <strong>{user.name}</strong>
            <span>{adminRoleLabels[user.role]}</span>
          </div>
          <button type="button" className="btn btn-quiet topbar-exit" onClick={signOut}>
            <Icon name="logout" />
            Sair
          </button>
        </div>
      </header>
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
