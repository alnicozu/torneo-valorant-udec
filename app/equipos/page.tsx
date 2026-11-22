import Link from 'next/link';
import Avatar from '@/components/Avatar';
import PlayerPhoto from '@/components/PlayerPhoto';
import { getTeams, MIN_ROSTER, teamLogoUrl } from '@/lib/data';

export const metadata = { title: 'Equipos · Torneo de Valorant UdeC 5vs5' };

export default async function EquiposPage() {
  const teams = await getTeams();
  const captains = teams
    .flatMap((t) => {
      const c = t.members.find((m) => m.id === t.captain_id);
      return c ? [{ team: t, c }] : [];
    })
    .sort((a, b) => a.team.name.localeCompare(b.team.name, 'es'));
  return (
    <div className="container">
      <div className="page-head">
        <div className="eyebrow">{teams.length} inscritos</div>
        <h1 className="title">Equipos</h1>
        <p className="subtitle">Un equipo queda completo con {MIN_ROSTER} jugadores. Pueden sumar hasta 2 suplentes.</p>
        {captains.length > 0 && (
          <div className="tabs-inline" style={{ marginTop: 16 }}>
            <a className="btn ghost sm" href="#capitanes">Capitanes</a>
            <a className="btn ghost sm" href="#lista-equipos">Equipos</a>
          </div>
        )}
      </div>

      {captains.length > 0 && (
        <section id="capitanes" style={{ scrollMarginTop: 90, marginBottom: 48 }}>
          <div className="section-head">
            <h2 className="section-title">Capitanes</h2>
          </div>
          <p className="muted" style={{ marginTop: -6, marginBottom: 16 }}>El líder de cada equipo: es quien inscribe al equipo y habla con la organización.</p>
          <div className="player-grid">
            {captains.map(({ team: t, c }) => (
              <Link key={t.id} href={`/jugadores/${encodeURIComponent(c.id)}`} className="pcard pcard-captain">
                <div className="pcard-photo">
                  <PlayerPhoto src={c.avatar} name={c.name} />
                  <span className="cap-badge">👑 Capitán</span>
                  <div className="pcard-team">
                    {t.has_logo ? <img className="cap-team-logo" src={teamLogoUrl(t)} alt="" /> : <span className="tag violet">{t.tag}</span>}
                    <span className="tn">{t.name}</span>
                  </div>
                </div>
                <div className="pcard-body">
                  <div className="pcard-name" title={c.name}>{c.name}</div>
                  <div className="pcard-riot" title={c.riot_id ?? ''}>{c.riot_id ?? 'Sin Riot ID'}</div>
                  {(c.role || c.rank) && (
                    <div className="pcard-meta">
                      {c.role && <span className="tag">{c.role}</span>}
                      {c.rank && <span className="tag gold">{c.rank}</span>}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {teams.length === 0 ? (
        <div className="empty">Aún no hay equipos inscritos. ¡Sé el primero!</div>
      ) : (
        <div id="lista-equipos" className="grid cols-3" style={{ scrollMarginTop: 90 }}>
          {teams.map((t) => {
            const ok = t.members.length >= MIN_ROSTER;
            return (
              <Link key={t.id} href={`/equipos/${t.id}`} className="panel team-card tcard">
                <div className="tcard-logo">
                  {t.has_logo ? <img src={teamLogoUrl(t)} alt={`Logo de ${t.name}`} loading="lazy" /> : <span className="tcard-tag">{t.tag}</span>}
                </div>
                <div className="tcard-body">
                  <div style={{ minWidth: 0 }}>
                    <div className="team-name-lg">{t.name}</div>
                    <div className="small muted"><span className="tag violet" style={{ marginRight: 8 }}>{t.tag}</span>{t.members.length} jugadores</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div className="roster-mini">
                      {t.members.slice(0, 7).map((m) => <Avatar key={m.id} src={m.avatar} name={m.name} />)}
                    </div>
                    <span className={`tag ${ok ? 'ok' : 'gold'}`}>{ok ? 'Completo' : `Faltan ${MIN_ROSTER - t.members.length}`}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
