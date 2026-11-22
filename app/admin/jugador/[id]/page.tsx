import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getTeams, getUser, MAX_ROSTER, RANKS, ROLES } from '@/lib/data';
import { adminRemovePlayerPhoto, adminSavePlayer, adminUploadPlayerPhoto } from '../../actions';
import Avatar from '@/components/Avatar';
import ConfirmButton from '@/components/ConfirmButton';
import LogoUploader from '@/components/LogoUploader';

export const metadata = { title: 'Editar jugador · Admin' };

export default async function EditPlayerPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; err?: string } }) {
  const me = await getCurrentUser();
  if (!me?.isAdmin) redirect('/');
  const id = decodeURIComponent(params.id);
  const [u, teams] = await Promise.all([getUser(id), getTeams()]);
  if (!u) notFound();
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const team = teams.find((t) => t.id === u.team_id) ?? null;
  const isCaptain = !!team && team.captain_id === u.id;
  const hasPhoto = !!u.avatar?.startsWith('/api/user-photo/');
  const fromDiscord = !u.id.startsWith('manual-') && !u.is_bot;
  const page = `/admin/jugador/${encodeURIComponent(u.id)}`;

  return (
    <div className="container">
      <div className="page-head">
        <Link className="link-more" href="/admin#jugadores">← Volver al panel</Link>
        <div className="eyebrow" style={{ marginTop: 14 }}>Panel de admin</div>
        <h1 className="title">Editar jugador</h1>
      </div>

      {searchParams.ok && <div className="alert ok">{searchParams.ok}</div>}
      {searchParams.err && <div className="alert err">{searchParams.err}</div>}

      <section className="panel pad">
        <div className="player-cell" style={{ marginBottom: 16 }}>
          <Avatar src={u.avatar} name={u.name} size="md" />
          <span>
            {u.name}
            {u.is_bot && <span className="tag bot">Bot</span>}
            {u.id.startsWith('manual-') && <span className="tag">Sin Discord</span>}
            <div className="riot">ID: {u.id}</div>
          </span>
        </div>
        <form action={adminSavePlayer}>
          <input type="hidden" name="user_id" value={u.id} />
          <div className="form-row">
            <div className="field">
              <label htmlFor="name">Nombre</label>
              <input className="input" id="name" name="name" maxLength={32} required defaultValue={u.name} />
            </div>
            <div className="field">
              <label htmlFor="riot_id">Riot ID</label>
              <input className="input" id="riot_id" name="riot_id" placeholder="Nombre#TAG" defaultValue={u.riot_id ?? ''} />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 12 }}>
            <div className="field">
              <label htmlFor="rank">Rango</label>
              <select className="input" id="rank" name="rank" defaultValue={u.rank ?? ''}>
                <option value="">Sin especificar</option>
                {RANKS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="role">Rol</label>
              <select className="input" id="role" name="role" defaultValue={u.role ?? ''}>
                <option value="">Sin especificar</option>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 12, alignItems: 'end' }}>
            <div className="field">
              <label htmlFor="team_id">Equipo</label>
              <select className="input" id="team_id" name="team_id" defaultValue={u.team_id ?? ''}>
                <option value="">Sin equipo (agente libre)</option>
                {sorted.map((t) => {
                  const full = t.members.length >= MAX_ROSTER && t.id !== u.team_id;
                  return (
                    <option key={t.id} value={t.id} disabled={full}>
                      {t.name} [{t.tag}] · {t.members.length}/{MAX_ROSTER}{full ? ' (lleno)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 14, paddingBottom: 10 }}>
              <input type="checkbox" name="captain" defaultChecked={isCaptain} /> Capitán del equipo
            </label>
          </div>
          {fromDiscord && (
            <p className="muted small" style={{ marginTop: 10 }}>
              Este jugador entra con Discord: si vuelve a iniciar sesión, su <b>nombre</b> se actualiza con el de su Discord. El resto (Riot ID, rango, rol, equipo) se mantiene.
            </p>
          )}
          <div className="form-actions"><button className="btn">Guardar cambios</button></div>
        </form>
      </section>

      <section className="panel pad" style={{ marginTop: 16 }}>
        <h2 className="section-title" style={{ fontSize: 22 }}>Foto de perfil</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <Avatar src={u.avatar} name={u.name} size="lg" />
          <LogoUploader key={u.avatar ?? ''} action={adminUploadPlayerPhoto} field="photo" hidden={{ user_id: u.id, return_to: page }} saveLabel="Guardar foto" fit="cover" round />
          {hasPhoto && (
            <form action={adminRemovePlayerPhoto}>
              <input type="hidden" name="user_id" value={u.id} />
              <input type="hidden" name="return_to" value={page} />
              <ConfirmButton className="btn ghost sm" message={`¿Quitar la foto de ${u.name}?`}>Quitar foto</ConfirmButton>
            </form>
          )}
        </div>
      </section>

      {team && (
        <p style={{ marginTop: 16 }}>
          <Link className="link-more" href={`/admin/equipo/${team.id}`}>Editar su equipo ({team.name}) →</Link>
        </p>
      )}
    </div>
  );
}
