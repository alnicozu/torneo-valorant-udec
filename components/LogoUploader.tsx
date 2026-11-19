'use client';
import { useRef, useState } from 'react';

type Props = {
  action: (fd: FormData) => void;
  /** Nombre del campo que recibe la imagen en el servidor. */
  field?: string;
  /** Campos ocultos extra (por ejemplo el id del equipo o jugador). */
  hidden?: Record<string, string | number>;
  saveLabel?: string;
  /** 'contain' deja la imagen entera (logos); 'cover' la recorta al cuadrado (fotos de perfil). */
  fit?: 'contain' | 'cover';
  round?: boolean;
};

/** Elige una imagen, la achica a 256x256 en el navegador y la envía al servidor. */
export default function LogoUploader({ action, field = 'logo', hidden, saveLabel = 'Guardar logo', fit = 'contain', round = false }: Props) {
  const [data, setData] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr('');
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErr('El archivo tiene que ser una imagen.');
    if (f.size > 10 * 1024 * 1024) return setErr('La imagen pesa demasiado (máximo 10 MB).');
    const img = new Image();
    img.onload = () => {
      const S = 256;
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const ctx = c.getContext('2d')!;
      const r = fit === 'cover' ? Math.max(S / img.width, S / img.height) : Math.min(S / img.width, S / img.height);
      const w = img.width * r, h = img.height * r;
      ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      let out = c.toDataURL('image/webp', 0.85);
      if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/png');
      setData(out);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => setErr('No se pudo leer la imagen.');
    img.src = URL.createObjectURL(f);
  }

  return (
    <form action={action} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name={field} value={data} />
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {data && <img src={data} alt="Vista previa" className="team-logo" style={round ? { borderRadius: '50%', objectFit: 'cover' } : undefined} />}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} style={{ display: 'none' }} />
      <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>
        {data ? 'Elegir otra imagen' : 'Elegir imagen'}
      </button>
      {data && <button className="btn sm">{saveLabel}</button>}
      {err && <span className="small" style={{ color: '#ff8f99' }}>{err}</span>}
    </form>
  );
}
