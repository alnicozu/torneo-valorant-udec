'use client';
import { useMemo, useState } from 'react';
import ScheduleView from '@/components/ScheduleView';
import ConfirmButton from '@/components/ConfirmButton';
import { aHora, NOMBRE_REGLA, nombreDia, resolver, type Dia, type Parametros } from '@/lib/horarios';

type Props = {
  inicial: Parametros;
  equiposInscritos: number;
  hayCuadro: boolean;
  equiposCuadro: number;
  nombres: Record<string, string>;
  publicado: { publicadoEn: string; partidos: number; equipos: number } | null;
  guardar: (fd: FormData) => void;
  publicar: (fd: FormData) => void;
  retirar: (fd: FormData) => void;
};

const h = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}`.trim() : `${min} min`);

function Num({ label, value, onChange, min, max, step = 1, suf, help }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; step?: number; suf?: string; help?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input className="input" type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ maxWidth: 120 }} />
        {suf && <span className="muted small">{suf}</span>}
      </div>
      {help && <div className="muted small" style={{ marginTop: 4 }}>{help}</div>}
    </div>
  );
}

export default function HorariosTool(props: Props) {
  const [p, setP] = useState<Parametros>(props.inicial);
  const set = (k: keyof Parametros, v: any) => setP((x) => ({ ...x, [k]: v }));
  const setDia = (i: number, k: keyof Dia, v: string) => setP((x) => ({ ...x, dias: x.dias.map((d, j) => (j === i ? { ...d, [k]: v } : d)) }));
  const { parametros: pn, resultados, mejor } = useMemo(() => resolver(p), [p]);
  const m = mejor.metricas;
  const json = JSON.stringify(pn);
  const nombresValidos = props.hayCuadro && props.equiposCuadro === pn.equipos ? props.nombres : undefined;

  return (
    <>
      {/* ------------------------------ 1. Parámetros ------------------------------ */}
      <section className="panel pad">
        <div className="model-step">1</div>
        <h2 className="section-title" style={{ fontSize: 22 }}>Parámetros</h2>
        <p className="muted small" style={{ marginTop: 4 }}>Los datos de entrada que nosotros definimos. Cambia cualquiera y el modelo se vuelve a resolver al instante.</p>

        <div className="form-row" style={{ marginTop: 14, alignItems: 'start' }}>
          <Num label="N° de equipos (N)" value={p.equipos} onChange={(v) => set('equipos', v)} min={2} max={64}
            help={`Inscritos ahora: ${props.equiposInscritos}.`} />
          <Num label="Duración BO1" value={p.minBo1} onChange={(v) => set('minBo1', v)} min={10} max={240} suf="min" help="Rondas antes de semifinales." />
          <Num label="Duración BO3" value={p.minBo3} onChange={(v) => set('minBo3', v)} min={20} max={480} suf="min" help="Semifinales y final." />
        </div>
        {props.equiposInscritos >= 2 && props.equiposInscritos !== p.equipos && (
          <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => set('equipos', props.equiposInscritos)}>Usar los {props.equiposInscritos} equipos inscritos</button>
        )}
        <div className="form-row" style={{ marginTop: 14, alignItems: 'start' }}>
          <Num label="Descanso mínimo del mismo equipo (X)" value={p.descanso} onChange={(v) => set('descanso', v)} min={0} max={600} suf="min" help="Entre el fin de un partido y el siguiente del ganador." />
          <Num label="Cambio entre partidos" value={p.cambio} onChange={(v) => set('cambio', v)} min={0} max={120} suf="min" help="Preparar la transmisión y el lobby." />
          <Num label="Tamaño del bloque horario" value={p.bloque} onChange={(v) => set('bloque', v)} min={5} max={60} step={5} suf="min" help="Los partidos empiezan en múltiplos de este bloque." />
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>Días disponibles y ventana horaria</label>
          <div className="dias-list">
            {p.dias.map((d, i) => (
              <div key={i} className="dia-row">
                <input className="input" type="date" value={d.fecha} onChange={(e) => setDia(i, 'fecha', e.target.value)} />
                <input className="input" type="time" value={d.inicio} onChange={(e) => setDia(i, 'inicio', e.target.value)} />
                <span className="muted">a</span>
                <input className="input" type="time" value={d.fin} onChange={(e) => setDia(i, 'fin', e.target.value)} />
                <span className="muted small" style={{ minWidth: 110 }}>{nombreDia(d.fecha)}</span>
                {p.dias.length > 1 && <button type="button" className="btn ghost sm" onClick={() => set('dias', p.dias.filter((_, j) => j !== i))}>Quitar</button>}
              </div>
            ))}
          </div>
          {p.dias.length < 7 && (
            <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => {
              const last = p.dias[p.dias.length - 1];
              const dt = last ? new Date(last.fecha + 'T12:00:00Z') : new Date();
              dt.setUTCDate(dt.getUTCDate() + 1);
              set('dias', [...p.dias, { fecha: dt.toISOString().slice(0, 10), inicio: last?.inicio ?? '15:00', fin: last?.fin ?? '21:00' }]);
            }}>+ Agregar día</button>
          )}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, marginTop: 14, fontSize: 14 }}>
          <input type="checkbox" checked={p.tercerLugar} onChange={(e) => set('tercerLugar', e.target.checked)} /> Incluir partido por el 3er lugar (BO3)
          <span className="muted small" style={{ fontWeight: 400 }}>— el reglamento actual no lo contempla</span>
        </label>
      </section>

      {/* ------------------------------ 2. Formulación ------------------------------ */}
      <section className="panel pad" style={{ marginTop: 16 }}>
        <div className="model-step">2</div>
        <h2 className="section-title" style={{ fontSize: 22 }}>Formulación del modelo</h2>
        <div className="model-grid">
          <div className="model-box">
            <h3>Conjuntos y parámetros</h3>
            <ul>
              <li><b>M</b>: partidos del cuadro de eliminación directa. Con N = {pn.equipos} equipos hay <b>|M| = N − 1{pn.tercerLugar ? ' + 1' : ''} = {m.partidos}</b> partidos.</li>
              <li><b>P(m)</b>: partidos que alimentan a m (de ahí salen sus equipos).</li>
              <li><b>D</b>: días disponibles ({pn.dias.length}); cada día d con ventana [a<sub>d</sub>, b<sub>d</sub>].</li>
              <li><b>p<sub>m</sub></b>: duración de m ({pn.minBo1} min si es BO1, {pn.minBo3} min si es BO3).</li>
              <li><b>X</b> = {pn.descanso} min de descanso; <b>c</b> = {pn.cambio} min de cambio; bloque de {pn.bloque} min.</li>
            </ul>
          </div>
          <div className="model-box">
            <h3>Variable de decisión</h3>
            <ul>
              <li><b>s<sub>m</sub></b>: bloque horario (día y hora de inicio) asignado al partido m. Lo calcula el modelo.</li>
              <li>Fin del partido: f<sub>m</sub> = s<sub>m</sub> + p<sub>m</sub>.</li>
            </ul>
            <h3 style={{ marginTop: 14 }}>Función objetivo</h3>
            <ul><li><b>min C<sub>max</sub></b> = max<sub>m</sub> f<sub>m</sub>: que el torneo termine lo antes posible, con todo dentro de los días disponibles.</li></ul>
          </div>
          <div className="model-box" style={{ gridColumn: '1 / -1' }}>
            <h3>Restricciones</h3>
            <ol>
              <li><b>Una sola transmisión</b> (sin partidos en paralelo): para todo par m ≠ n, s<sub>n</sub> ≥ f<sub>m</sub> + c  o  s<sub>m</sub> ≥ f<sub>n</sub> + c.</li>
              <li><b>Dependencias del cuadro</b>: s<sub>m</sub> ≥ f<sub>k</sub> para todo k ∈ P(m) (una semifinal no va antes que sus cuartos).</li>
              <li><b>Descanso</b>: s<sub>m</sub> ≥ f<sub>k</sub> + X para todo k ∈ P(m).</li>
              <li><b>Ventana horaria</b>: cada partido queda completo en un día: a<sub>d</sub> ≤ s<sub>m</sub> y f<sub>m</sub> ≤ b<sub>d</sub>; s<sub>m</sub> empieza en un bloque de {pn.bloque} min.</li>
            </ol>
          </div>
          <div className="model-box" style={{ gridColumn: '1 / -1' }}>
            <h3>Método de solución</h3>
            <p className="small" style={{ margin: 0 }}>
              Es un problema de programación en <b>una máquina</b> (la transmisión) con precedencias, retardos (descanso) y ventanas de tiempo
              (1 | prec, l<sub>ij</sub>, ventanas | C<sub>max</sub>). Se resuelve con <b>programación por lista</b>: en cada paso se toma, entre los partidos
              cuyos previos ya están programados, el que puede empezar antes, y se desempata con una regla de prioridad. Se prueban dos reglas
              y se elige la de menor término. Para saber qué tan buena es, se compara con una <b>cota inferior</b> (ningún programa puede terminar antes):
              el máximo entre la carga total (Σ p<sub>m</sub> + cambios) y el camino crítico del cuadro (rondas encadenadas + descansos).
              Si el resultado iguala a la cota, es <b>óptimo</b>.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------ 3. Resultado ------------------------------ */}
      <section className="panel pad" style={{ marginTop: 16 }}>
        <div className="model-step">3</div>
        <h2 className="section-title" style={{ fontSize: 22 }}>Resultado</h2>
        {!mejor.factible && (
          <div className="alert err" style={{ marginTop: 12 }}>
            No caben todos los partidos: faltan {mejor.sinAsignar.length} ({mejor.sinAsignar.map((x) => x.id).join(', ')}). Agrega un día, amplía la ventana o reduce duraciones/descanso.
          </div>
        )}
        <div className="kpis">
          <div className="kpi"><div className="n">{m.partidos}</div><div className="l">Partidos</div></div>
          <div className="kpi"><div className="n">{h(m.minutosJuego)}</div><div className="l">Tiempo de juego</div></div>
          <div className="kpi"><div className="n">{h(m.makespanVentana)}</div><div className="l">Término (C<sub>max</sub>, en ventana)</div></div>
          <div className="kpi"><div className="n">{h(m.cotaInferior)}</div><div className="l">Cota inferior</div></div>
          <div className="kpi"><div className={`n ${m.optimo ? 'ok' : ''}`}>{mejor.factible ? (m.optimo ? 'Óptimo' : `+${m.brecha}%`) : '—'}</div><div className="l">Brecha vs. cota</div></div>
          <div className="kpi"><div className="n">{m.utilizacion}%</div><div className="l">Uso de la transmisión</div></div>
          <div className="kpi"><div className="n">{m.diasUsados}/{pn.dias.length}</div><div className="l">Días usados</div></div>
          <div className="kpi"><div className="n">{h(m.ocioso)}</div><div className="l">Tiempo sin partido</div></div>
        </div>
        {mejor.asignados.length > 0 && (
          <p className="muted small" style={{ marginTop: 10 }}>
            Primer partido: <b>{nombreDia(pn.dias[mejor.asignados[0].dia].fecha)} {aHora(mejor.asignados[0].inicio)}</b> · Último termina: <b>{nombreDia(pn.dias[mejor.asignados[mejor.asignados.length - 1].dia].fecha)} {aHora(mejor.asignados[mejor.asignados.length - 1].fin)}</b>
          </p>
        )}

        <h3 style={{ fontSize: 16, marginTop: 18 }}>Comparación de reglas de prioridad</h3>
        <div className="panel" style={{ overflowX: 'auto', marginTop: 8 }}>
          <table className="table">
            <thead><tr><th>Regla</th><th>¿Cabe todo?</th><th>Término</th><th>Tiempo sin partido</th><th /></tr></thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={r.regla}>
                  <td style={{ fontWeight: 700 }}>{NOMBRE_REGLA[r.regla]}</td>
                  <td>{r.factible ? <span className="tag ok">Sí</span> : <span className="tag red">Faltan {r.sinAsignar.length}</span>}</td>
                  <td>{h(r.metricas.makespanVentana)}</td>
                  <td>{h(r.metricas.ocioso)}</td>
                  <td>{r === mejor && <span className="tag gold">Elegida</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: 16, marginTop: 18 }}>Programación (variable de decisión resuelta)</h3>
        <div style={{ marginTop: 8 }}>
          <ScheduleView parametros={pn} asignados={mejor.asignados} nombres={nombresValidos} />
        </div>

        <h3 style={{ fontSize: 16, marginTop: 18 }}>Verificación de restricciones</h3>
        <ul className="checks">
          {mejor.verificacion.map((v) => (
            <li key={v.regla} className={v.ok ? 'ok' : 'bad'}><span className="ic">{v.ok ? '✓' : '✗'}</span><b>{v.regla}</b><span className="muted small"> — {v.detalle}</span></li>
          ))}
        </ul>
      </section>

      {/* ------------------------------ 4. Revisión y publicación ------------------------------ */}
      <section className="panel pad" style={{ marginTop: 16 }}>
        <div className="model-step">4</div>
        <h2 className="section-title" style={{ fontSize: 22 }}>Revisión y publicación</h2>
        <p className="muted small" style={{ marginTop: 4 }}>
          Nada de esto se ve en la página pública hasta que lo publiquen. <b>Guardar borrador</b> deja estos parámetros guardados para que el resto de los admins los revise.
        </p>
        {props.publicado ? (
          <div className="alert ok" style={{ marginTop: 12 }}>
            Hay una programación publicada ({props.publicado.partidos} partidos, {props.publicado.equipos} equipos) desde el {new Date(props.publicado.publicadoEn).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}. Se ve en <a href="/calendario" style={{ textDecoration: 'underline' }}>Calendario</a>.
          </div>
        ) : (
          <div className="alert" style={{ marginTop: 12 }}>Todavía no hay una programación publicada.</div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
          <form action={props.guardar}>
            <input type="hidden" name="params" value={json} />
            <button className="btn ghost">Guardar borrador</button>
          </form>
          <form action={props.publicar} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="hidden" name="params" value={json} />
            {props.hayCuadro && (
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
                <input type="checkbox" name="aplicar" defaultChecked={props.equiposCuadro === pn.equipos} disabled={props.equiposCuadro !== pn.equipos} />
                Poner estos horarios en los partidos del cuadro
                {props.equiposCuadro !== pn.equipos && <span className="muted small">(el cuadro tiene {props.equiposCuadro} equipos)</span>}
              </label>
            )}
            {mejor.factible ? (
              <ConfirmButton className="btn" message={`¿Publicar esta programación (${m.partidos} partidos)? Todos los usuarios la verán en Calendario.`}>Publicar programación</ConfirmButton>
            ) : (
              <button className="btn" disabled title="No caben todos los partidos">Publicar programación</button>
            )}
          </form>
          {props.publicado && (
            <form action={props.retirar}>
              <ConfirmButton className="btn ghost" message="¿Retirar la programación publicada? Deja de verse en Calendario.">Retirar publicación</ConfirmButton>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
