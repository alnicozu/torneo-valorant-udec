import Countdown from './Countdown';
import { CIERRE_INSCRIPCIONES, TEXTO_CIERRE, TEXTO_JUEGO } from '@/lib/evento';

/** Recuadro destacado: valor de inscripción, alcance, fechas y cuenta regresiva. */
export default function FreeBanner() {
  return (
    <div className="free-banner fee-variant">
      <div className="free-top">
        <span className="free-word">Inscripción $7.500 <small>por equipo</small></span>
        <span className="free-pill">🇨🇱 Abierto para todo Chile</span>
      </div>
      <div className="free-dates">
        <div><span className="ico">📝</span>{TEXTO_CIERRE}</div>
        <div><span className="ico">🎮</span>{TEXTO_JUEGO}</div>
      </div>
      <div className="free-cd-label">El cierre de inscripciones es en</div>
      <Countdown to={CIERRE_INSCRIPCIONES} />
    </div>
  );
}
