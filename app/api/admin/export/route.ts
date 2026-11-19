import { getCurrentUser } from '@/lib/auth';
import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Descarga la lista de inscritos en CSV (se abre en Excel o Google Sheets). Solo admins. */
export async function GET() {
  const u = await getCurrentUser();
  if (!u?.isAdmin) return new Response('No autorizado', { status: 403 });
  const rows = await q(
    `select t.name as equipo, t.tag, u.name as jugador, u.riot_id, u.rank, u.role,
            (t.captain_id = u.id) as capitan, u.id as discord_id, u.is_bot
     from users u left join teams t on t.id = u.team_id
     order by t.name nulls last, (t.captain_id = u.id) desc, lower(u.name)`
  );
  const head = ['Equipo', 'Tag', 'Jugador', 'Riot ID', 'Rango', 'Rol', 'Capitán', 'ID Discord', 'Simulado'];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.join(';')];
  for (const r of rows) {
    const id = String(r.discord_id);
    lines.push([
      r.equipo ?? 'Sin equipo', r.tag ?? '', r.jugador, r.riot_id ?? '', r.rank ?? '', r.role ?? '',
      r.capitan ? 'Sí' : '', id.startsWith('manual-') ? '(sin Discord)' : id, r.is_bot ? 'Sí' : '',
    ].map(esc).join(';'));
  }
  // BOM para que Excel lea bien los tildes; ";" es el separador que usa Excel en Chile.
  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inscritos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
