import { useRef } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { Icon } from '../../shared/icons';
import { SafeWalkMark } from '../../shared/safewalk-mark';
import { AuthScene } from './auth-scene';
import { LiveTicker } from './live-ticker';
import './auth.css';

/** Moldura das telas de acesso do painel: cena da cidade ao fundo, apresentação e cartão. */
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);

  // Brilho que acompanha o ponteiro sobre o cartão (só posição; a cor fica no CSS).
  const followPointer = (event: PointerEvent<HTMLDivElement>) => {
    const element = card.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    element.style.setProperty('--mx', `${event.clientX - box.left}px`);
    element.style.setProperty('--my', `${event.clientY - box.top}px`);
  };

  return (
    <div className="auth">
      <AuthScene />
      <div className="auth-shell">
        <section className="auth-intro" aria-label="Sobre o painel">
          <div className="auth-brand reveal">
            <SafeWalkMark size={44} />
            <div className="auth-brand-name">
              <strong>SafeWalk</strong>
              <span>Painel da Prefeitura</span>
            </div>
            <span className="auth-demo">Demonstração</span>
          </div>
          <h2 className="auth-headline reveal">
            <span>A rua avisa.</span>
            <span className="auth-headline-glow">A cidade age.</span>
          </h2>
          <p className="auth-lede reveal">
            Buracos, semáforos com defeito e calçadas quebradas chegam com local, foto e prioridade
            sugerida. Sua equipe decide o próximo passo e quem relatou acompanha.
          </p>
          <div className="reveal auth-ticker-wrap">
            <LiveTicker />
          </div>
          <ul className="auth-facts reveal">
            <li>
              <Icon name="list" />
              Fila priorizada
            </li>
            <li>
              <Icon name="map" />
              Mapa e pontos críticos
            </li>
            <li>
              <Icon name="history" />
              Histórico de cada caso
            </li>
          </ul>
        </section>

        <main className="auth-main">
          <div className="auth-card" ref={card} onPointerMove={followPointer}>
            <header className="auth-head">
              <span className="auth-head-icon" aria-hidden="true">
                <Icon name="shield" />
              </span>
              <h1 id="auth-title">{title}</h1>
              <p>{description}</p>
            </header>
            {children}
            <p className="auth-secure">
              <Icon name="lock" />
              Conexão protegida. A sessão vale só nesta aba e termina ao fechá-la.
            </p>
          </div>
          <p className="auth-note">
            Demonstração do SafeWalk. Os relatos vêm de pessoas que escolheram enviá-los pelo app e
            não são protocolos do SP156.
          </p>
        </main>
      </div>
    </div>
  );
}
