import { q } from '@/lib/db';

/** Foto de perfil subida por un admin (se guarda aparte para no cargarla en cada listado). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const [row] = await q('select data from user_photos where user_id=$1', [params.id]);
  const m = typeof row?.data === 'string' ? row.data.match(/^data:(image\/(?:webp|png|jpeg));base64,(.+)$/) : null;
  if (!m) return new Response('No encontrado', { status: 404 });
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
