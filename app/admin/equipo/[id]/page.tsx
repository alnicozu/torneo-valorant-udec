import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getTeam, MAX_ROSTER, MIN_ROSTER } from '@/lib/data';
import { adminAddPlayersToTeam, adminKickFromTeam, adminRemoveTeamLogo, adminSaveTeam, adminUploadTeamLogo } from '../../actions';
import Avatar from '@/components/Avatar';
import ConfirmButton from '@/components/ConfirmButton';
import LogoUploader from '@/components/LogoUploader';
import TeamBadge from '@/components/TeamBadge';

export const metadata = { title: 'Editar equipo · Admin' };

export default async function EditTeamPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; err?: string } }) {
  const me = await getCurrentUser();
  if (!me?.isAdmin) redirect('/');
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const t = await getTeam(id);
  if (!t) notFound();
  const page = `/admin/equipo/${t.id}`;
  const free = MAX_ROSTER - t.members.length;

  return (
    <div className="container">
      <div className="page-head">
        <Link className="link-more" href="/admin#equipos">← Volver al panel</Link>
        <div className="eyebrow" style={{ marginTop: 14 }}>Panel de admin</div>
        <h1 className="title">Editar equipo</h1>
      </div>

      {searchParams.ok && <div className="alert ok">{searchParams.ok}</div>}
      {searchParams.err && <div className="alert err">{searchParams.err}</div>}

      <section className="panel pad">
        <div className="player-cell" style={{ marginBottom: 16 }}>
          <span className="badge-sm"><TeamBadge team={t} /></span>
          <span>{t.name}{t.is_bot && <span className="tag bot">Bot</span>}<div className="riot">Código del equipo: {t.invite_code}</div></span>
        </div>
        <form action={adminSaveTeam}>
          <input type="hidden" name="team_id" value={t.id} />
          <div className="form-row">
            <div className="field">
              <label htmlFor="name">Nombre del equipo</label>
              <input className="input" id="name" name="name" maxLength={30} required defaultValue={t.name} />
            </div>
            <div className="field">
              <label htmlFor="tag">Tag</label>
              <input className="input" id="tag" name="tag" maxLength={5} required defaultValue={t.tag} style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="field">
              <label htmlFor="captain_id">Capitán</label>
              <select className="input" id="captain_id" name="captain_id" defaultValue={t.members.some((m) => m.id === t.captain_id) ? t.captain_id : ''}>
                {!t.members.some((m) => m.id === t.captain_id) && <option value="">Sin capitán</option>}
                {t.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions"><button className="btn">Guardar cambios</button></div>
        </form>
      </section>

      <section className="panel pad" style={{ marginTop: 16 }}>
        <h2 className="section-title" style={{ fontSize: 22 }}>Logo</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <TeamBadge team={t} size="xl" />
          <LogoUploader key={t.logo_v ?? 0} action={adminUploadTeamLogo} hidden={{ team_id: t.id, return_to: page }} />
          {t.has_logo && (
            <form action={adminRemoveTeamLogo}>
              <input type="hidden" name="team_id" value={t.id} />
              <input type="hidden" name="return_to" value={page} />
              <ConfirmButton className="btn ghost sm" message={`¿Quitar el logo de "${t.name}"?`}>Quitar logo</ConfirmButton>
            </form>
          )}
        </div>
      </section>

      <section className="panel pad" style={{ marginTop: 16 }}>
        <h2 className="section-title" style={{ fontSize: 22 }}>
          Integrantes <span className={`tag ${t.members.length >= MIN_ROSTER ? 'ok' : 'gold'}`}>{t.members.length}/{MAX_ROSTER}</span>
        </h2>
        {t.members.length === 0 ? <div className="empty" style={{ marginTop: 12 }}>Este equipo no tiene jugadores.</div> : (
          <div className="panel" style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="table">
              <tbody>
                {t.members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="player-cell">
                        <Avatar src={m.avatar} name={m.name} />
                        <span>{m.name}{m.id === t.captain_id && <span className="tag gold">Capitán</span>}<div className="riot">{m.riot_id ?? 'Sin Riot ID'}</div></span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Link className="btn ghost sm" href={`/admin/jugador/${encodeURIComponent(m.id)}`}>Editar</Link>
                        <form action={adminKickFromTeam}>
                          <input type="hidden" name="team_id" value={t.id} />
                          <input type="hidden" name="user_id" value={m.id} />
                          <ConfirmButton className="btn ghost sm" message={`¿Quitar a ${m.name} de ${t.name}? Queda como agente libre (no se borra).`}>Quitar del equipo</ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {free > 0 && (
          <form action={adminAddPlayersToTeam} style={{ marginTop: 16 }}>
            <input type="hidden" name="team_id" value={t.id} />
            <div className="field">
              <label htmlFor="players">Agregar jugadores (caben {free} más)</label>
              <textarea className="input" id="players" name="players" rows={Math.min(free, 4)} placeholder={'Juan, juanito#LAS\nPedro, pedrox#1234'} required />
            </div>
            <p className="muted small" style={{ marginTop: 6 }}>Un jugador por línea: <code>Nombre, Riot#TAG</code>. Para pasar a alguien que ya existe a este equipo, usa <b>Editar</b> en ese jugador y elige el equipo.</p>
            <div className="form-actions"><button className="btn sm">Agregar</button></div>
          </form>
        )}
      </section>
    </div>
  );
}
