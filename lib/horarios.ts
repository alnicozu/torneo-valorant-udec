// =====================================================================
// Modelo de programación de horarios (scheduling) del torneo.
//
//   Parámetros  : N° de equipos, días y ventana horaria de cada día, duración de
//                 cada partido según formato (BO1 / BO3), descanso mínimo entre
//                 partidos de un mismo equipo, tiempo de cambio entre partidos de
//                 la transmisión y tamaño del bloque horario.
//   Variable    : s_m = bloque horario (inicio) asignado a cada partido m.
//   Restricciones:
//     (1) Una sola transmisión: dos partidos nunca se cruzan.
//     (2) Dependencias del cuadro: un partido empieza después de que terminen
//         los partidos que lo alimentan.
//     (3) Descanso: s_m >= fin(p) + descanso, para cada partido p que alimenta a m
//         (el ganador de p juega m).
//     (4) Ventana: cada partido empieza y termina dentro de la ventana de un día.
//   Objetivo    : minimizar el término del torneo (makespan, C_max).
//
// Este problema es una "máquina única con precedencias, retardos y ventanas"
// (1 | prec, l_ij, ventanas | C_max). Se resuelve con programación por lista
// (heurística constructiva) usando dos reglas de prioridad; se elige la mejor y se
// compara contra una cota inferior para saber si es óptima.
// =====================================================================

import { BO_EARLY, BO_FINAL, BO_SEMIS, roundName, seedOrder } from './bracket';

export type Dia = { fecha: string; inicio: string; fin: string }; // '2026-11-21', '15:00', '21:00'

export type Parametros = {
  equipos: number;
  dias: Dia[];
  minBo1: number;
  minBo3: number;
  descanso: number; // min entre partidos de un mismo equipo
  cambio: number; // min entre partidos (cambio de transmisión)
  bloque: number; // tamaño del bloque horario en minutos
  tercerLugar: boolean;
};

export const PARAMETROS_BASE: Parametros = {
  equipos: 8,
  dias: [
    { fecha: '2026-11-21', inicio: '15:00', fin: '21:00' },
    { fecha: '2026-11-22', inicio: '15:00', fin: '21:00' },
  ],
  minBo1: 45,
  minBo3: 120,
  descanso: 30,
  cambio: 10,
  bloque: 15,
  tercerLugar: false,
};

export type Partido = {
  id: string; // código: P1, P2...
  ronda: number;
  slot: number;
  tercer: boolean;
  bo: number;
  dur: number;
  deps: string[]; // partidos que lo alimentan
  etiqueta: string; // "Cuartos de final · 1"
  cruce: string; // "Sembrado 1 vs Sembrado 8" / "Ganador P1 vs Ganador P2"
};

export type Asignado = Partido & {
  dia: number; // índice del día
  inicio: number; // minutos desde las 00:00 de ese día
  fin: number;
};

export type Regla = 'ronda' | 'critico';
export const NOMBRE_REGLA: Record<Regla, string> = {
  ronda: 'Ronda menor primero',
  critico: 'Camino crítico primero',
};

export type Verificacion = { regla: string; ok: boolean; detalle: string };

export type Resultado = {
  regla: Regla;
  factible: boolean;
  asignados: Asignado[];
  sinAsignar: Partido[];
  metricas: {
    partidos: number;
    minutosJuego: number;
    minutosDisponibles: number;
    makespanVentana: number; // minutos de ventana usados desde el inicio hasta el fin del último partido
    cotaInferior: number;
    brecha: number; // % sobre la cota inferior
    optimo: boolean;
    ocioso: number; // minutos de ventana sin partido (hasta el último partido)
    utilizacion: number; // % de la ventana usada con partidos
    diasUsados: number;
  };
  verificacion: Verificacion[];
};

// ----------------------------- utilidades -----------------------------
export const aMin = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  return m ? Math.min(24 * 60, +m[1] * 60 + +m[2]) : 0;
};
export const aHora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export function nombreDia(fecha: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha || '');
  if (!m) return fecha;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dias[d.getUTCDay()]} ${+m[3]} ${meses[+m[2] - 1]}`;
}

/** Limpia y acota los parámetros (vienen de un formulario). */
export function normalizar(p: Partial<Parametros>): Parametros {
  const n = (v: any, def: number, min: number, max: number) => {
    const x = Math.round(Number(v));
    return Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : def;
  };
  const dias = (Array.isArray(p.dias) ? p.dias : PARAMETROS_BASE.dias)
    .filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) && aMin(d.fin) > aMin(d.inicio))
    .slice(0, 7)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    equipos: n(p.equipos, PARAMETROS_BASE.equipos, 2, 64),
    dias,
    minBo1: n(p.minBo1, PARAMETROS_BASE.minBo1, 10, 240),
    minBo3: n(p.minBo3, PARAMETROS_BASE.minBo3, 20, 480),
    descanso: n(p.descanso, PARAMETROS_BASE.descanso, 0, 600),
    cambio: n(p.cambio, PARAMETROS_BASE.cambio, 0, 120),
    bloque: n(p.bloque, PARAMETROS_BASE.bloque, 5, 60),
    tercerLugar: !!p.tercerLugar,
  };
}

// ------------------- 1) Partidos que genera el cuadro -------------------
/** Arma la lista de partidos reales (sin byes) del cuadro de eliminación directa. */
export function partidosDelCuadro(p: Parametros): Partido[] {
  const N = p.equipos;
  let size = 2;
  while (size < N) size *= 2;
  const rondas = Math.log2(size);
  const order = seedOrder(size);
  const bo = (r: number) => {
    const count = size / 2 ** r;
    return count === 1 ? BO_FINAL : count === 2 ? BO_SEMIS : BO_EARLY;
  };
  const dur = (b: number) => (b >= 3 ? p.minBo3 : p.minBo1);

  const real = new Map<string, Partido>();
  let k = 0;
  const lista: Partido[] = [];
  // Ronda 1: solo los cruces con dos equipos (los demás son byes).
  const pasaDirecto = new Map<number, number>(); // slot de ronda 1 -> sembrado que pasa directo
  for (let s = 0; s < size / 2; s++) {
    const a = order[2 * s], b = order[2 * s + 1];
    if (a <= N && b <= N) {
      const id = `P${++k}`;
      const m: Partido = {
        id, ronda: 1, slot: s, tercer: false, bo: bo(1), dur: dur(bo(1)), deps: [],
        etiqueta: `${roundName(1, rondas)} · ${s + 1}`,
        cruce: `Sembrado ${Math.min(a, b)} vs Sembrado ${Math.max(a, b)}`,
      };
      real.set(`1-${s}`, m);
      lista.push(m);
    } else {
      pasaDirecto.set(s, a <= N ? a : b);
    }
  }
  const lado = (r: number, s: number) => {
    // describe quién llega desde la posición (r, s) a la ronda r+1
    const m = real.get(`${r}-${s}`);
    if (m) return { dep: m.id, txt: `Ganador ${m.id}` };
    const seed = pasaDirecto.get(s);
    return { dep: null as string | null, txt: `Sembrado ${seed}` };
  };
  for (let r = 2; r <= rondas; r++) {
    const count = size / 2 ** r;
    for (let s = 0; s < count; s++) {
      const A = lado(r - 1, 2 * s), B = lado(r - 1, 2 * s + 1);
      const id = `P${++k}`;
      const m: Partido = {
        id, ronda: r, slot: s, tercer: false, bo: bo(r), dur: dur(bo(r)),
        deps: [A.dep, B.dep].filter(Boolean) as string[],
        etiqueta: count === 1 ? roundName(r, rondas) : `${roundName(r, rondas)} · ${s + 1}`,
        cruce: `${A.txt} vs ${B.txt}`,
      };
      real.set(`${r}-${s}`, m);
      lista.push(m);
    }
  }
  if (p.tercerLugar && rondas >= 2) {
    const semis = lista.filter((m) => m.ronda === rondas - 1);
    if (semis.length === 2) {
      const b3 = BO_SEMIS;
      lista.push({
        id: `P${++k}`, ronda: rondas, slot: 1, tercer: true, bo: b3, dur: dur(b3),
        deps: semis.map((m) => m.id),
        etiqueta: 'Partido por el 3er lugar',
        cruce: `Perdedor ${semis[0].id} vs Perdedor ${semis[1].id}`,
      });
    }
  }
  return lista;
}

// ------------------- 2) Programación por lista -------------------
type Ventana = { dia: number; ini: number; fin: number };

function ventanas(p: Parametros): Ventana[] {
  return p.dias.map((d, i) => ({ dia: i, ini: aMin(d.inicio), fin: aMin(d.fin) }));
}
// Tiempo absoluto = dia * 1440 + minuto del día (para comparar entre días).
const abs = (dia: number, min: number) => dia * 1440 + min;

/** Primer bloque factible >= t (absoluto) donde cabe un partido de duración dur. */
function primerBloque(t: number, dur: number, vs: Ventana[], bloque: number): { dia: number; ini: number } | null {
  for (const v of vs) {
    const a = abs(v.dia, v.ini), b = abs(v.dia, v.fin);
    if (t >= b) continue;
    let s = Math.max(t, a);
    const off = (s - a) % bloque; // alinear al bloque horario
    if (off) s += bloque - off;
    if (s + dur <= b) return { dia: v.dia, ini: s - v.dia * 1440 };
  }
  return null;
}

/** "Cola": camino más largo desde el inicio de m hasta el fin del torneo (para la regla de camino crítico). */
function colas(lista: Partido[], p: Parametros) {
  const hijos = new Map<string, Partido[]>();
  for (const m of lista) for (const d of m.deps) hijos.set(d, [...(hijos.get(d) ?? []), m]);
  const memo = new Map<string, number>();
  const cola = (m: Partido): number => {
    if (memo.has(m.id)) return memo.get(m.id)!;
    const hs = hijos.get(m.id) ?? [];
    const v = m.dur + (hs.length ? Math.max(...hs.map((h) => p.descanso + cola(h))) : 0);
    memo.set(m.id, v);
    return v;
  };
  return new Map(lista.map((m) => [m.id, cola(m)]));
}

export function programar(p: Parametros, regla: Regla): Resultado {
  const lista = partidosDelCuadro(p);
  const vs = ventanas(p);
  const cola = colas(lista, p);
  const prio = (m: Partido) => (regla === 'ronda' ? [m.ronda, m.tercer ? 1 : 0, m.slot] : [-cola.get(m.id)!, m.ronda, m.slot]);
  const cmp = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

  const hecho = new Map<string, Asignado>();
  const pendientes = [...lista];
  const sinAsignar: Partido[] = [];
  let cursor = vs.length ? abs(vs[0].dia, vs[0].ini) : 0; // la transmisión queda libre desde aquí

  while (pendientes.length) {
    const listos = pendientes.filter((m) => m.deps.every((d) => hecho.has(d)));
    if (!listos.length) break; // (no debería ocurrir: el cuadro es un árbol)
    let mejor: { m: Partido; dia: number; ini: number } | null = null;
    for (const m of listos) {
      // liberación: fin de los partidos que lo alimentan + descanso
      const rel = Math.max(cursor, ...m.deps.map((d) => { const x = hecho.get(d)!; return abs(x.dia, x.fin) + p.descanso; }));
      const b = primerBloque(rel, m.dur, vs, p.bloque);
      if (!b) continue;
      const t = abs(b.dia, b.ini);
      if (!mejor || t < abs(mejor.dia, mejor.ini) || (t === abs(mejor.dia, mejor.ini) && cmp(prio(m), prio(mejor.m)) < 0)) mejor = { m, ...b };
    }
    if (!mejor) {
      // lo que queda no cabe en los días disponibles
      sinAsignar.push(...pendientes);
      break;
    }
    const a: Asignado = { ...mejor.m, dia: mejor.dia, inicio: mejor.ini, fin: mejor.ini + mejor.m.dur };
    hecho.set(a.id, a);
    pendientes.splice(pendientes.indexOf(mejor.m), 1);
    cursor = abs(a.dia, a.fin) + p.cambio;
  }

  const asignados = [...hecho.values()].sort((x, y) => abs(x.dia, x.inicio) - abs(y.dia, y.inicio));
  return evaluar(p, regla, lista, asignados, sinAsignar, cola);
}

// ------------------- 3) Métricas, cota inferior y verificación -------------------
function evaluar(p: Parametros, regla: Regla, lista: Partido[], asignados: Asignado[], sinAsignar: Partido[], cola: Map<string, number>): Resultado {
  const vs = ventanas(p);
  const disponible = vs.reduce((s, v) => s + (v.fin - v.ini), 0);
  const minutosJuego = lista.reduce((s, m) => s + m.dur, 0);
  // minutos de ventana transcurridos hasta un instante (sin contar la noche entre días)
  const enVentana = (dia: number, min: number) =>
    vs.filter((v) => v.dia < dia).reduce((s, v) => s + (v.fin - v.ini), 0) + Math.max(0, min - (vs[dia]?.ini ?? 0));
  const ultimo = asignados[asignados.length - 1];
  const makespanVentana = ultimo ? enVentana(ultimo.dia, ultimo.fin) : 0;

  // Cota inferior: (a) todo el tiempo de juego + cambios, en una sola transmisión;
  //                (b) el camino crítico del cuadro (rondas seguidas + descansos).
  const lbCarga = minutosJuego + Math.max(0, lista.length - 1) * p.cambio;
  const lbCritico = lista.length ? Math.max(...lista.map((m) => cola.get(m.id)!)) : 0;
  const cotaInferior = Math.max(lbCarga, lbCritico);
  const factible = sinAsignar.length === 0;
  const brecha = factible && cotaInferior ? Math.round(((makespanVentana - cotaInferior) / cotaInferior) * 1000) / 10 : 0;

  // Verificación de restricciones sobre la solución
  const porId = new Map(asignados.map((a) => [a.id, a]));
  const v: Verificacion[] = [];
  let choques = 0;
  for (let i = 1; i < asignados.length; i++) {
    const a = asignados[i - 1], b = asignados[i];
    if (abs(b.dia, b.inicio) < abs(a.dia, a.fin) + (a.dia === b.dia ? p.cambio : 0)) choques++;
  }
  v.push({ regla: 'Una sola transmisión (sin partidos en paralelo)', ok: choques === 0, detalle: choques ? `${choques} cruce(s)` : `${Math.max(0, asignados.length - 1)} pares consecutivos revisados` });
  let depMal = 0, descMal = 0, depTot = 0;
  for (const a of asignados) for (const d of a.deps) {
    const x = porId.get(d); if (!x) continue; depTot++;
    const gap = abs(a.dia, a.inicio) - abs(x.dia, x.fin);
    if (gap < 0) depMal++;
    if (gap < p.descanso) descMal++;
  }
  v.push({ regla: 'Dependencias del cuadro (no antes de sus partidos previos)', ok: depMal === 0, detalle: `${depTot} dependencias revisadas` });
  v.push({ regla: `Descanso ≥ ${p.descanso} min entre partidos del mismo equipo`, ok: descMal === 0, detalle: descMal ? `${descMal} sin descanso suficiente` : `${depTot} casos revisados` });
  const fuera = asignados.filter((a) => a.inicio < vs[a.dia].ini || a.fin > vs[a.dia].fin).length;
  v.push({ regla: 'Dentro de la ventana horaria de los días disponibles', ok: fuera === 0, detalle: `${asignados.length} partidos revisados` });
  v.push({ regla: 'Todos los partidos programados', ok: factible, detalle: factible ? `${lista.length} de ${lista.length}` : `faltan ${sinAsignar.length}: no caben en los días disponibles` });

  const usadoHasta = makespanVentana;
  const ocupado = asignados.reduce((s, a) => s + a.dur, 0);
  return {
    regla, factible, asignados, sinAsignar,
    metricas: {
      partidos: lista.length,
      minutosJuego,
      minutosDisponibles: disponible,
      makespanVentana,
      cotaInferior,
      brecha,
      optimo: factible && makespanVentana <= cotaInferior,
      ocioso: Math.max(0, usadoHasta - ocupado),
      utilizacion: usadoHasta ? Math.round((ocupado / usadoHasta) * 1000) / 10 : 0,
      diasUsados: new Set(asignados.map((a) => a.dia)).size,
    },
    verificacion: v,
  };
}

/** Corre ambas reglas y elige la mejor (factible primero; luego menor término). */
export function resolver(pIn: Partial<Parametros>) {
  const p = normalizar(pIn);
  const res = (['ronda', 'critico'] as Regla[]).map((r) => programar(p, r));
  const mejor = [...res].sort((a, b) =>
    (a.factible === b.factible ? 0 : a.factible ? -1 : 1) ||
    a.sinAsignar.length - b.sinAsignar.length ||
    a.metricas.makespanVentana - b.metricas.makespanVentana
  )[0];
  return { parametros: p, resultados: res, mejor };
}

export type Publicado = {
  parametros: Parametros;
  regla: Regla;
  asignados: Asignado[];
  publicadoEn: string;
};

// ------------------- 4) Nombres reales desde el cuadro -------------------
/** Clave para cruzar un partido del modelo con el partido del cuadro guardado. */
export const claveCuadro = (m: { ronda: number; slot: number; tercer: boolean }) => (m.tercer ? 'tercer' : `${m.ronda}-${m.slot}`);

/**
 * Si ya existe el cuadro y tiene la misma forma que el modelo, devuelve "Equipo A vs Equipo B"
 * para los partidos cuyos dos equipos ya se conocen.
 */
export function nombresDesdeCuadro(
  equipos: number,
  matches: { round: number; slot: number; third_place: boolean; team1_id: number | null; team2_id: number | null }[],
  teams: { id: number; name: string }[]
): Record<string, string> {
  if (!matches.length) return {};
  let size = 2;
  while (size < equipos) size *= 2;
  const rondas = Math.max(...matches.map((m) => m.round));
  const enR1 = new Set(matches.filter((m) => m.round === 1).flatMap((m) => [m.team1_id, m.team2_id]).filter((x) => x != null));
  if (rondas !== Math.log2(size) || enR1.size !== equipos) return {};
  const nombre = new Map(teams.map((t) => [t.id, t.name]));
  const out: Record<string, string> = {};
  for (const m of matches) {
    if (m.team1_id == null || m.team2_id == null) continue;
    const a = nombre.get(m.team1_id), b = nombre.get(m.team2_id);
    if (a && b) out[m.third_place ? 'tercer' : `${m.round}-${m.slot}`] = `${a} vs ${b}`;
  }
  return out;
}

/** "2026-11-21T15:30" para guardar en el partido del cuadro. */
export const fechaHora = (p: Parametros, a: Asignado) => `${p.dias[a.dia].fecha}T${aHora(a.inicio)}`;
