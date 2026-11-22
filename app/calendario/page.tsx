import MatchRow from '@/components/MatchRow';
import ScheduleView from '@/components/ScheduleView';
import { roundName } from '@/lib/bracket';
import { q } from '@/lib/db';
import { getMatches, getTeams } from '@/lib/data';
import { nombresDesdeCuadro, type Publicado } from '@/lib/horarios';

export const metadata = { title: 'Calendario · Torneo de Valorant UdeC 5vs5' };

export default async function CalendarioPage() {
  const [matches, teams, pubRows, allMatches] = await Promise.all([
    getMatches(),
    getTeams(),
    q("select value from settings where key='schedule_published'"),
    q('select round, slot, third_place, team1_id, team2_id from matches'),
  ]);
  let pub: Publicado | null = null;
  try { pub = pubRows[0]?.value ? JSON.parse(pubRows[0].value) : null; } catch { pub = null; }
  const nombres = pub ? nombresDesdeCuadro(pub.parametros.equipos, allMatches as any, teams) : {};
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const rounds = matches.length ? Math.max(...matches.map((m) => m.round)) : 0;
  const list = matches.filter((m) => !(m.round === 1 && (m.team1_id == null) !== (m.team2_id == null)));
  const groups: { name: string; items: typeof list }[] = [];
  for (let r = 1; r <= rounds; r++) {
    const items = list.filter((m) => m.round === r && !m.third_place).sort((a, b) => (a.scheduled_at ?? '9').localeCompare(b.scheduled_at ?? '9'));
    if (items.length) groups.push({ name: roundName(r, rounds), items });
    if (r === rounds) {
      const third = list.filter((m) => m.third_place);
      if (third.length) groups.splice(groups.length - 1, 0, { name: 'Partido por el 3er lugar', items: third });
    }
  }
  return (
    <div className="container">
      <div className="page-head">
        <div className="eyebrow">Fechas y horarios</div>
        <h1 className="title">Calendario</h1>
        <p className="subtitle">Horarios de Chile. Los equipos deben estar conectados 15 minutos antes de cada partido.</p>
      </div>
      {pub && (
        <section style={{ marginBottom: 40 }}>
          <div className="section-head">
            <h2 className="section-title">Programación oficial</h2>
          </div>
          <p className="muted" style={{ marginTop: -6, marginBottom: 16 }}>
            {pub.asignados.length} partidos en una sola transmisión. Cada barra es un partido; los ganadores tienen al menos {pub.parametros.descanso} min de descanso antes de su siguiente partido.
          </p>
          <ScheduleView parametros={pub.parametros} asignados={pub.asignados} nombres={nombres} />
        </section>
      )}
      {groups.length === 0 ? (
        !pub && <div className="empty">El calendario se publicará junto con el cuadro.</div>
      ) : (
        groups.map((g) => (
          <div key={g.name} style={{ marginBottom: 32 }}>
            <h2 className="section-title" style={{ marginBottom: 12, fontSize: 22 }}>{g.name}</h2>
            <div className="panel">
              {g.items.map((m) => <MatchRow key={m.id} m={m} teams={teamMap} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
