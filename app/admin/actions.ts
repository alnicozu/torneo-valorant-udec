'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { q } from '@/lib/db';
import { generateBracket, recomputeBracket } from '@/lib/bracket';
import { getTeams, MIN_ROSTER, newRegCode, randomCode, removeFromTeam, setSetting, userPhotoUrl } from '@/lib/data';
import { createBotPlayer, createBotTeam, randomScores } from '@/lib/sim';

function back(kind: 'ok' | 'err', msg: string, hash = ''): never {
  revalidatePath('/', 'layout');
  redirect(`/admin?${kind}=${encodeURIComponent(msg)}${hash}`);
}
async function requireAdmin() {
  const u = await getCurrentUser();
  if (!u?.isAdmin) redirect('/');
}

export async function saveSettings(fd: FormData) {
  await requireAdmin();
  await setSetting('registration_open', fd.get('registration_open') ? '1' : '0');
  for (const k of ['stream_channel', 'discord_invite', 'instagram', 'facebook', 'x', 'tiktok', 'whatsapp', 'announcement']) {
    await setSetting(k, String(fd.get(k) ?? '').trim());
  }
  back('ok', 'Ajustes guardados.');
}

export async function createBracket(fd: FormData) {
  await requireAdmin();
  const onlyFull = !!fd.get('only_full');
  const mode = String(fd.get('mode') ?? 'random');
  let teams = await getTeams();
  if (onlyFull) teams = teams.filter((t) => t.members.length >= MIN_ROSTER);
  if (teams.length < 2) back('err', 'Se necesitan al menos 2 equipos para armar el cuadro.');
  let ids = teams.map((t) => t.id);
  if (mode === 'random') {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
  }
  await generateBracket(q, ids);
  await setSetting('registration_open', '0');
  back('ok', `Cuadro creado con ${ids.length} equipos. Las inscripciones quedaron cerradas.`);
}

export async function deleteBracket() {
  await requireAdmin();
  await q('delete from matches');
  back('ok', 'Cuadro eliminado.');
}

export async function saveMatch(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get('id'));
  const num = (k: string) => {
    const v = String(fd.get(k) ?? '').trim();
    return v === '' ? null : Math.max(0, Math.min(3, Math.floor(Number(v)) || 0));
  };
  const [m] = await q('select * from matches where id=$1', [id]);
  if (!m) back('err', 'Partido no encontrado.');
  let s1 = num('score1');
  let s2 = num('score2');
  if ((s1 == null) !== (s2 == null)) back('err', 'Ingresa ambos marcadores (o deja ambos vacíos).', '#partidos');
  if (s1 != null) {
    const need = Math.ceil(m.best_of / 2);
    if (s1 === s2 || Math.max(s1, s2) !== need) {
      back('err', `En un BO${m.best_of} el ganador debe llegar a ${need} (ej: ${need}-0${need > 1 ? ` o ${need}-1` : ''}).`, '#partidos');
    }
  }
  const when = String(fd.get('scheduled_at') ?? '').trim() || null;
  await q('update matches set score1=$2, score2=$3, scheduled_at=$4 where id=$1', [id, s1, s2, when]);
  await recomputeBracket(q);
  back('ok', 'Partido actualizado.', '#partidos');
}

const IMG_RE = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/;

export async function adminUploadTeamLogo(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get('team_id'));
  const logo = String(fd.get('logo') ?? '');
  if (!IMG_RE.test(logo)) back('err', 'Elige una imagen PNG, JPG o WEBP.', '#equipos');
  if (logo.length > 400_000) back('err', 'La imagen es muy pesada. Prueba con otra más simple.', '#equipos');
  await q('update teams set logo=$2, logo_v=logo_v+1 where id=$1', [id, logo]);
  back('ok', 'Logo del equipo actualizado.', '#equipos');
}

export async function adminUploadPlayerPhoto(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get('user_id') ?? '');
  const photo = String(fd.get('photo') ?? '');
  if (!IMG_RE.test(photo)) back('err', 'Elige una imagen PNG, JPG o WEBP.', '#jugadores');
  if (photo.length > 400_000) back('err', 'La imagen es muy pesada. Prueba con otra más simple.', '#jugadores');
  const [u] = await q('select id from users where id=$1', [id]);
  if (!u) back('err', 'Ese jugador ya no existe.', '#jugadores');
  await q(
    'insert into user_photos (user_id, data) values ($1,$2) on conflict (user_id) do update set data = excluded.data',
    [id, photo]
  );
  await q('update users set avatar=$2 where id=$1', [id, userPhotoUrl(id)]);
  back('ok', 'Foto del jugador actualizada.', '#jugadores');
}

export async function adminRemovePlayerPhoto(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get('user_id') ?? '');
  await q('delete from user_photos where user_id=$1', [id]);
  // Si entra con Discord, vuelve a aparecer su foto de Discord.
  await q("update users set avatar=null where id=$1 and avatar like '/api/user-photo/%'", [id]);
  back('ok', 'Foto quitada.', '#jugadores');
}

export async function adminRemoveTeamLogo(fd: FormData) {
  await requireAdmin();
  await q('update teams set logo=null, logo_v=logo_v+1 where id=$1', [Number(fd.get('team_id'))]);
  back('ok', 'Logo quitado.', '#equipos');
}

export async function deleteTeam(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get('team_id'));
  const [{ n }] = await q('select count(*)::int as n from matches where team1_id=$1 or team2_id=$1', [id]);
  if (n > 0) back('err', 'Ese equipo ya está en el cuadro. Elimina el cuadro primero.', '#equipos');
  await q('update users set team_id=null where team_id=$1', [id]);
  await q('update reg_codes set team_id=null, used_at=null where team_id=$1', [id]); // el código queda libre otra vez
  await q('delete from teams where id=$1', [id]);
  back('ok', 'Equipo eliminado.', '#equipos');
}

export async function adminRemoveFromTeam(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get('user_id') ?? '');
  await removeFromTeam(id);
  back('ok', 'Jugador quitado de su equipo.', '#jugadores');
}

/** Borra el perfil del jugador. Puede volver a entrar con Discord cuando quiera. */
export async function adminDeletePlayer(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get('user_id') ?? '');
  await removeFromTeam(id);
  await q('delete from user_photos where user_id=$1', [id]);
  await q('delete from users where id=$1', [id]);
  back('ok', 'Jugador eliminado. Si vuelve a entrar con Discord, empieza con un perfil nuevo.', '#jugadores');
}

export async function createRegCode(fd: FormData) {
  await requireAdmin();
  const note = String(fd.get('note') ?? '').trim().slice(0, 80) || null;
  let code = newRegCode();
  for (let i = 0; i < 5; i++) {
    const r = await q('insert into reg_codes (code, note) values ($1,$2) on conflict do nothing returning code', [code, note]);
    if (r.length) break;
    code = newRegCode();
  }
  back('ok', `Código creado: ${code}. Envíaselo al capitán del equipo.`, '#codigos');
}

export async function deleteRegCode(fd: FormData) {
  await requireAdmin();
  const code = String(fd.get('code') ?? '');
  const r = await q('delete from reg_codes where code=$1 and team_id is null returning code', [code]);
  if (!r.length) back('err', 'Ese código ya fue usado; elimina el equipo primero si quieres liberarlo.', '#codigos');
  back('ok', 'Código eliminado.', '#codigos');
}

// ---------- Simulación con bots ----------
export async function simTeams(fd: FormData) {
  await requireAdmin();
  const n = Math.max(1, Math.min(32, Math.floor(Number(fd.get('count')) || 0)));
  const subs = !!fd.get('subs');
  for (let i = 0; i < n; i++) {
    const size = subs ? MIN_ROSTER + Math.floor(Math.random() * 3) : MIN_ROSTER;
    await createBotTeam(q, size);
  }
  back('ok', `Se crearon ${n} equipos simulados.`, '#simulacion');
}

export async function simFreeAgents(fd: FormData) {
  await requireAdmin();
  const n = Math.max(1, Math.min(50, Math.floor(Number(fd.get('count')) || 0)));
  for (let i = 0; i < n; i++) await createBotPlayer(q, null, i);
  back('ok', `Se crearon ${n} jugadores simulados sin equipo.`, '#simulacion');
}

export async function simFillTeams() {
  await requireAdmin();
  const teams = await getTeams();
  let added = 0;
  for (const t of teams) {
    for (let i = t.members.length; i < MIN_ROSTER; i++) {
      await createBotPlayer(q, t.id, i);
      added++;
    }
  }
  back('ok', added ? `Se agregaron ${added} jugadores simulados para completar equipos.` : 'Todos los equipos ya estaban completos.', '#simulacion');
}

export async function simRound() {
  await requireAdmin();
  const n = await randomScores(q);
  if (!n) back('err', 'No hay partidos listos para simular. Crea el cuadro primero.', '#simulacion');
  await recomputeBracket(q);
  back('ok', `Se simularon ${n} partidos de la ronda actual.`, '#simulacion');
}

export async function simDeleteAll() {
  await requireAdmin();
  const [{ n }] = await q(
    `select count(*)::int as n from matches m join teams t on t.id in (m.team1_id, m.team2_id) where t.is_bot`
  );
  if (n > 0) await q('delete from matches');
  const botTeams = await q('select id from teams where is_bot');
  for (const t of botTeams) {
    await q('update users set team_id=null where team_id=$1 and not is_bot', [t.id]);
    await q('update reg_codes set team_id=null, used_at=null where team_id=$1', [t.id]);
  }
  await q('delete from user_photos where user_id in (select id from users where is_bot)');
  await q('delete from users where is_bot');
  await q('delete from teams where is_bot');
  // Equipos reales que quedaron sin jugadores (solo tenían bots) se mantienen; el capitán sigue igual.
  back('ok', `Se borraron todos los bots${n > 0 ? ' y el cuadro (tenía equipos simulados)' : ''}.`, '#simulacion');
}

// ---------- Equipos a mano (gente que se inscribió sin Discord) ----------
export async function adminCreateTeam(fd: FormData) {
  await requireAdmin();
  const name = String(fd.get('name') ?? '').trim().replace(/\s+/g, ' ');
  const tag = String(fd.get('tag') ?? '').trim().toUpperCase();
  if (name.length < 3 || name.length > 30) back('err', 'El nombre del equipo debe tener entre 3 y 30 caracteres.', '#manual');
  if (!/^[A-Z0-9]{2,5}$/.test(tag)) back('err', 'El tag debe tener de 2 a 5 letras o números.', '#manual');
  const lines = String(fd.get('players') ?? '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 7);
  if (!lines.length) back('err', 'Escribe al menos un jugador (uno por línea).', '#manual');
  const dup = await q('select 1 from teams where lower(name)=lower($1)', [name]);
  if (dup.length) back('err', 'Ya existe un equipo con ese nombre.', '#manual');
  const [t] = await q(
    `insert into teams (name, tag, captain_id, invite_code) values ($1,$2,'pendiente',$3) returning id`,
    [name, tag, randomCode()]
  );
  let captain = '';
  for (let i = 0; i < lines.length; i++) {
    const [nick, riot] = lines[i].split(/[,;]/).map((s) => s.trim());
    const id = `manual-${randomCode(10).toLowerCase()}`;
    await q(
      `insert into users (id, name, riot_id, team_id, created_at) values ($1,$2,$3,$4, now() + ($5 || ' milliseconds')::interval)`,
      [id, (nick || `Jugador ${i + 1}`).slice(0, 32), riot && riot.includes('#') ? riot.slice(0, 24) : null, t.id, String(i * 10)]
    );
    if (i === 0) captain = id;
  }
  await q('update teams set captain_id=$2 where id=$1', [t.id, captain]);
  back('ok', `Equipo "${name}" creado con ${lines.length} jugadores.`, '#equipos');
}

export async function adminEditTeam(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get('team_id'));
  const name = String(fd.get('name') ?? '').trim().replace(/\s+/g, ' ');
  const tag = String(fd.get('tag') ?? '').trim().toUpperCase();
  if (name.length < 3 || name.length > 30) back('err', 'El nombre del equipo debe tener entre 3 y 30 caracteres.', '#equipos');
  if (!/^[A-Z0-9]{2,5}$/.test(tag)) back('err', 'El tag debe tener de 2 a 5 letras o números.', '#equipos');
  const dup = await q('select 1 from teams where lower(name)=lower($1) and id<>$2', [name, id]);
  if (dup.length) back('err', 'Ya existe otro equipo con ese nombre.', '#equipos');
  await q('update teams set name=$2, tag=$3 where id=$1', [id, name, tag]);
  back('ok', 'Equipo actualizado.', '#equipos');
}
