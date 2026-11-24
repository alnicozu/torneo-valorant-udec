'use client';
import { useEffect, useState } from 'react';

const KEY = 'admin-funciones-ocultas';

/**
 * Muestra u oculta las funciones avanzadas del panel (todo lo marcado con la clase "admin-adv").
 * Por defecto quedan ocultas; la elección se recuerda en este navegador.
 */
export default function AdminUnlock({ target = 'admin-root' }: { target?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let saved = false;
    try { saved = localStorage.getItem(KEY) === '1'; } catch {}
    setOpen(saved);
  }, []);

  useEffect(() => {
    document.getElementById(target)?.classList.toggle('admin-locked', !open);
  }, [open, target]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(KEY, next ? '1' : '0'); } catch {}
  }

  return (
    <button type="button" className={`btn sm ${open ? '' : 'ghost'}`} onClick={toggle} aria-pressed={open}>
      {open ? '🔒 Ocultar funciones avanzadas' : '🔓 Mostrar funciones ocultas'}
    </button>
  );
}
