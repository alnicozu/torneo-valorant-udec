import { aHora, aMin, claveCuadro, nombreDia, type Asignado, type Parametros } from '@/lib/horarios';

/** Color del bloque según la etapa del cuadro. */
function etapa(a: Asignado, maxRonda: number) {
  if (a.tercer) return 'third';
  if (a.ronda === maxRonda) return 'final';
  if (a.ronda === maxRonda - 1) return 'semis';
  return 'early';
}
const corto = (a: Asignado, maxRonda: number) => {
  const e = etapa(a, maxRonda);
  return e === 'final' ? 'Final' : e === 'semis' ? `SF · ${a.id}` : e === 'third' ? '3er' : a.id;
};

/**
 * Muestra una programación: diagrama de Gantt por día (una sola transmisión = una sola fila)
 * y la tabla de partidos. `nombres` reemplaza el cruce por los equipos reales cuando se conocen.
 */
export default function ScheduleView({ parametros, asignados, nombres }: { parametros: Parametros; asignados: Asignado[]; nombres?: Record<string, string> }) {
  const maxRonda = asignados.length ? Math.max(...asignados.map((a) => a.ronda)) : 1;
  // a / b: minutos desde las 00:00 (para posicionar). d.inicio / d.fin siguen siendo el texto "HH:MM".
  const dias = parametros.dias.map((d, i) => ({ ...d, i, a: aMin(d.inicio), b: aMin(d.fin) }));
  return (
    <div className="sch">
      <div className="sch-legend">
        <span><i className="early" />Rondas iniciales (BO1)</span>
        <span><i className="semis" />Semifinales (BO3)</span>
        <span><i className="final" />Final (BO3)</span>
        {asignados.some((a) => a.tercer) && <span><i className="third" />3er lugar</span>}
      </div>
      {dias.map((d) => {
        const del = asignados.filter((a) => a.dia === d.i);
        const len = d.b - d.a;
        const horas: number[] = [];
        for (let h = Math.ceil(d.a / 60) * 60; h <= d.b; h += 60) horas.push(h);
        return (
          <div key={d.fecha} className="sch-day">
            <div className="sch-day-head">
              <b>{nombreDia(d.fecha)}</b>
              <span className="muted small">Ventana {d.inicio}–{d.fin} · {del.length} partido{del.length === 1 ? '' : 's'}</span>
            </div>
            <div className="gantt-scroll">
              <div className="gantt">
                <div className="gantt-scale">
                  {horas.map((h) => <span key={h} style={{ left: `${((h - d.a) / len) * 100}%` }}>{aHora(h)}</span>)}
                </div>
                <div className="gantt-track">
                  {horas.map((h) => <i key={h} className="gantt-tick" style={{ left: `${((h - d.a) / len) * 100}%` }} />)}
                  {del.map((a) => (
                    <div
                      key={a.id}
                      className={`gantt-block ${etapa(a, maxRonda)}`}
                      style={{ left: `${((a.inicio - d.a) / len) * 100}%`, width: `${(a.dur / len) * 100}%` }}
                      title={`${a.id} · ${a.etiqueta} · ${aHora(a.inicio)}–${aHora(a.fin)}`}
                    >
                      {corto(a, maxRonda)}
                    </div>
                  ))}
                  {del.length === 0 && <div className="gantt-empty">Sin partidos este día</div>}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="panel" style={{ overflowX: 'auto', marginTop: 16 }}>
        <table className="table sch-table">
          <thead>
            <tr><th>#</th><th>Partido</th><th>Cruce</th><th>Día</th><th>Horario</th><th>Formato</th></tr>
          </thead>
          <tbody>
            {asignados.map((a) => (
              <tr key={a.id}>
                <td><span className={`sch-dot ${etapa(a, maxRonda)}`} />{a.id}</td>
                <td style={{ fontWeight: 700 }}>{a.etiqueta}</td>
                <td>{nombres?.[claveCuadro(a)] ?? <span className="muted">{a.cruce}</span>}</td>
                <td>{nombreDia(parametros.dias[a.dia]?.fecha)}</td>
                <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{aHora(a.inicio)} – {aHora(a.fin)}</td>
                <td><span className={`tag ${a.bo >= 3 ? 'gold' : ''}`}>BO{a.bo}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
