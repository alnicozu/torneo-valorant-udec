import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { getTeams } from '@/lib/data';
import { nombresDesdeCuadro, normalizar, PARAMETROS_BASE, type Publicado } from '@/lib/horarios';
import { adminPublishSchedule, adminSaveScheduleDraft, adminUnpublishSchedule } from '../actions';
import HorariosTool from './HorariosTool';

export const metadata = { title: 'Modelo de horarios · Admin' };
export const dynamic = 'force-dynamic';

function leer<T>(raw: string | undefined): T | null {
  try { return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}

export default async function HorariosPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const me = await getCurrentUser();
  if (!me?.isAdmin) redirect('/');
  const [teams, rows, matches] = await Promise.all([
    getTeams(),
    q("select key, value from settings where key in ('schedule_draft','schedule_published')"),
    q('select round, slot, third_place, team1_id, team2_id from matches'),
  ]);
  const raw = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  const borrador = leer<any>(raw.schedule_draft);
  const publicado = leer<Publicado>(raw.schedule_published);
  const inscritos = teams.length;
  const equiposCuadro = new Set(matches.filter((m: any) => m.round === 1).flatMap((m: any) => [m.team1_id, m.team2_id]).filter((x: any) => x != null)).size;
  const inicial = normalizar(borrador ?? { ...PARAMETROS_BASE, equipos: equiposCuadro || Math.max(2, inscritos) });
  const nombres = nombresDesdeCuadro(equiposCuadro, matches, teams);

  return (
    <div className="container">
      <div className="page-head">
        <Link className="link-more" href="/admin">← Volver al panel</Link>
        <div className="eyebrow" style={{ marginTop: 14 }}>Herramienta de ingeniería · solo admins</div>
        <h1 className="title">Modelo de horarios</h1>
        <p className="subtitle">
          Programa los partidos del cuadro en los días y horarios disponibles, con una sola transmisión, respetando el orden del cuadro y el descanso de los equipos,
          y buscando que el torneo termine lo antes posible.
        </p>
      </div>

      {searchParams.ok && <div className="alert ok">{searchParams.ok}</div>}
      {searchParams.err && <div className="alert err">{searchParams.err}</div>}
      {borrador && <p className="muted small" style={{ marginBottom: 12 }}>Se cargaron los parámetros del último borrador guardado.</p>}

      <HorariosTool
        inicial={inicial}
        equiposInscritos={inscritos}
        hayCuadro={matches.length > 0}
        equiposCuadro={equiposCuadro}
        nombres={nombres}
        publicado={publicado ? { publicadoEn: publicado.publicadoEn, partidos: publicado.asignados.length, equipos: publicado.parametros.equipos } : null}
        guardar={adminSaveScheduleDraft}
        publicar={adminPublishSchedule}
        retirar={adminUnpublishSchedule}
      />
    </div>
  );
}
