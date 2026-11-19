import type { Q } from './db';
import { RANKS, ROLES, randomCode } from './data';

// ---------- Simulación (página de prueba) ----------
// Genera jugadores y equipos con datos realistas. Quedan marcados como bot
// (is_bot) para que los admins los vean y los puedan borrar todos juntos.

const NICKS = [
  'nachox', 'feeer', 'sebaa_cl', 'catalinaa', 'benjaa', 'valee', 'tomii', 'javiii', 'matiass', 'coniii', 'ignaa', 'danii',
  'pipeee', 'roci', 'joaco', 'flor', 'maxi', 'antoo', 'gabo', 'emii', 'luqui', 'isi', 'vicho', 'trini', 'diegoo', 'sofii',
  'cris', 'maite', 'agus', 'pancho', 'jose', 'bruno', 'ale', 'renata', 'kevo', 'leo', 'amanda', 'santi', 'paz', 'martina',
  'zeta', 'kuro', 'nyx', 'raze_main', 'sovaa', 'kayo', 'astra', 'neonn', 'phoenix', 'omen', 'yoru', 'chamber', 'fade',
  'tilteado', 'clutchito', 'headshot', 'wallbang', 'ecoround', 'oneTap', 'flick', 'peeker', 'lurker', 'entry', 'igl',
  'elpelao', 'guatón', 'cabro', 'pollo', 'chancho', 'gato', 'perro', 'lobo', 'puma', 'condor', 'huemul', 'copihue',
];
const SUFFIX = ['', '', '', '7', '99', '_cl', 'x', 'z', '01', '23', 'uwu', 'cl', 'ttv', '_', 'gg'];
const TAGS = ['LAS', 'CL', 'CHL', '1234', '2026', 'UDEC', 'CONCE', 'BIO', 'VAL', 'GG', 'SCL', '777', 'XD', 'LOL', 'MAIN'];
const T1 = ['Los', 'Team', 'Club', 'Escuadrón', 'Clan', 'Equipo'];
const T2 = [
  'Penquistas', 'Copihues', 'Huemules', 'Cóndores', 'Pumas', 'Lobos', 'Tiburones', 'Toros', 'Volcanes', 'Mapaches',
  'Patos', 'Choros', 'Pingüinos', 'Lagartos', 'Zorros', 'Murciélagos', 'Búhos', 'Halcones', 'Jaguares', 'Coyotes',
];
const T3 = ['', '', 'Gaming', 'Esports', 'GG', 'Rush', 'Clutch', 'Five', 'CL', 'del Bío Bío', 'de Conce', 'del Sur'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
function snowflake() {
  // Parecido a un ID de Discord (18-19 dígitos).
  let s = String(1 + Math.floor(Math.random() * 9));
  const len = 17 + Math.floor(Math.random() * 2);
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
  return s;
}
function nick() {
  const n = pick(NICKS) + pick(SUFFIX);
  return Math.random() < 0.2 ? n.charAt(0).toUpperCase() + n.slice(1) : n;
}
function avatar() {
  // Muchos usuarios reales usan el avatar por defecto de Discord.
  return Math.random() < 0.55 ? `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 6)}.png` : null;
}
function teamName() {
  const base = `${pick(T1)} ${pick(T2)}`;
  const suf = pick(T3);
  return (Math.random() < 0.4 ? base : `${pick(T2)}${suf ? ' ' + suf : ''}`).trim().slice(0, 30);
}
function tagFrom(name: string) {
  const letters = name.normalize('NFD').replace(/[^A-Za-z ]/g, '').split(' ').filter((w) => w.length > 2 && !['Los', 'del', 'de'].includes(w));
  let t = letters.map((w) => w[0]).join('').toUpperCase();
  if (t.length < 2) t = (letters[0] ?? 'TEAM').slice(0, 3).toUpperCase();
  return t.slice(0, 4);
}

export async function createBotPlayer(q: Q, teamId: number | null = null, i = 0) {
  const id = snowflake();
  const n = nick();
  await q(
    `insert into users (id, name, avatar, riot_id, rank, role, team_id, is_bot, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,true, now() + ($8 || ' milliseconds')::interval)`,
    [id, n, avatar(), `${n.replace(/[^A-Za-z0-9_]/g, '').slice(0, 14) || 'player'}#${pick(TAGS)}`,
      pick(RANKS.slice(1, 8)), ROLES[i % ROLES.length], teamId, String(i * 10)]
  );
  return id;
}

export async function createBotTeam(q: Q, size: number) {
  let name = teamName();
  for (let k = 0; k < 6; k++) {
    const dup = await q('select 1 from teams where lower(name)=lower($1)', [name]);
    if (!dup.length) break;
    name = teamName() + (k > 2 ? ` ${k}` : '');
  }
  const [t] = await q(
    `insert into teams (name, tag, captain_id, invite_code, is_bot) values ($1,$2,'pendiente',$3,true) returning id`,
    [name, tagFrom(name), randomCode()]
  );
  let captain = '';
  for (let i = 0; i < size; i++) {
    const id = await createBotPlayer(q, t.id, i);
    if (i === 0) captain = id;
  }
  await q('update teams set captain_id=$2 where id=$1', [t.id, captain]);
  return t.id as number;
}

/** Pone resultados al azar (válidos para BO1/BO3) en los partidos listos para jugarse. */
export async function randomScores(q: Q) {
  const ms = await q('select * from matches where winner_id is null and team1_id is not null and team2_id is not null order by round, slot');
  if (!ms.length) return 0;
  const round = ms[0].round;
  let n = 0;
  for (const m of ms.filter((x) => x.round === round)) {
    const need = Math.ceil(m.best_of / 2);
    const loser = m.best_of > 1 ? Math.floor(Math.random() * need) : 0;
    const t1wins = Math.random() < 0.5;
    await q('update matches set score1=$2, score2=$3 where id=$1', [m.id, t1wins ? need : loser, t1wins ? loser : need]);
    n++;
  }
  return n;
}
