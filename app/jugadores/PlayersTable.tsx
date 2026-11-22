'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import PlayerPhoto from '@/components/PlayerPhoto';

const ROLES = ['Duelista', 'Iniciador', 'Controlador', 'Centinela', 'Flex'];

export default function PlayersTable({ players }: { players: any[] }) {
  const [text, setText] = useState('');
  const [role, setRole] = useState('');
  const list = useMemo(() => {
    const t = text.trim().toLowerCase();
    return players.filter(
      (p) =>
        (!role || p.role === role) &&
        (!t || [p.name, p.riot_id, p.team_name].some((v) => v && v.toLowerCase().includes(t)))
    );
  }, [players, text, role]);

  return (
    <>
      <div className="toolbar">
        <input className="input" placeholder="Buscar jugador, Riot ID o equipo…" value={text} onChange={(e) => setText(e.target.value)} />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Todos los roles</option>
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      {list.length === 0 ? (
        <div className="empty">No hay jugadores que coincidan.</div>
      ) : (
        <div className="player-grid">
          {list.map((p) => (
            <Link key={p.id} href={`/jugadores/${encodeURIComponent(p.id)}`} className="pcard">
              <div className="pcard-photo">
                <PlayerPhoto src={p.avatar} name={p.name} />
                <div className="pcard-team">
                  {p.team_id ? (
                    <><span className="tag violet">{p.team_tag}</span><span className="tn">{p.team_name}</span></>
                  ) : <span className="tag">Agente libre</span>}
                </div>
              </div>
              <div className="pcard-body">
                <div className="pcard-name" title={p.name}>{p.name}</div>
                <div className="pcard-riot" title={p.riot_id ?? ''}>{p.riot_id ?? 'Sin Riot ID'}</div>
                {(p.role || p.rank) && (
                  <div className="pcard-meta">
                    {p.role && <span className="tag">{p.role}</span>}
                    {p.rank && <span className="tag gold">{p.rank}</span>}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
