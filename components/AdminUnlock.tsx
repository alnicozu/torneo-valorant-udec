'use client';
import { useEffect, useRef, useState } from 'react';

const KEY = 'admin-funciones-ocultas';
const CLICS = 5; // clics seguidos sobre el título
const VENTANA_MS = 2000; // tiempo máximo para hacerlos

/**
 * Título del panel. Muestra u oculta las funciones avanzadas (clase "admin-adv")
 * con 5 clics rápidos sobre el título; no hay ningún botón visible.
 * La elección se recuerda en este navegador.
 */
export default function AdminUnlock({ target = 'admin-root', children }: { target?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [aviso, setAviso] = useState('');
  const clics = useRef<number[]>([]);

  useEffect(() => {
    let saved = false;
    try { saved = localStorage.getItem(KEY) === '1'; } catch {}
    setOpen(saved);
  }, []);

  useEffect(() => {
    document.getElementById(target)?.classList.toggle('admin-locked', !open);
  }, [open, target]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 1800);
    return () => clearTimeout(t);
  }, [aviso]);

  function onClick() {
    const now = Date.now();
    clics.current = [...clics.current.filter((t) => now - t < VENTANA_MS), now];
    if (clics.current.length < CLICS) return;
    clics.current = [];
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(KEY, next ? '1' : '0'); } catch {}
    setAviso(next ? 'Funciones avanzadas visibles' : 'Funciones avanzadas ocultas');
  }

  return (
    <>
      <h1 className="title" onClick={onClick} style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>{children}</h1>
      {aviso && <div className="admin-toast" role="status">{aviso}</div>}
    </>
  );
}
