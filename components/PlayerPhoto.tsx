'use client';
import { useState } from 'react';

/** Las fotos de Discord vienen en 128 px por defecto; pedimos una más grande para las tarjetas. */
function bigAvatar(src: string) {
  if (/^https:\/\/cdn\.discordapp\.com\/avatars\//.test(src)) return src.replace(/\?.*$/, '') + '?size=512';
  return src;
}
function initials(name: string) {
  return (name || '').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2) || '?';
}

/** Foto grande de jugador para las tarjetas; si no hay o falla, muestra sus iniciales. */
export default function PlayerPhoto({ src, name }: { src?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <span className="initials">{initials(name)}</span>;
  return <img src={bigAvatar(src)} alt="" loading="lazy" onError={() => setBroken(true)} />;
}
