export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const connStr =
    req.headers.get('neon-connection-string') ||
    process.env.DATABASE_URL ||
    process.env.VITE_DATABASE_URL ||
    '';

  let targetHost = 'api.c-2.ap-southeast-1.aws.neon.tech';
  if (connStr) {
    try {
      const url = new URL(connStr);
      targetHost = url.hostname.replace(/^[^.]+\./, 'api.');
    } catch (_) {}
  }

  const body = await req.text();
  const headers = new Headers();
  headers.set('Host', targetHost);
  headers.set('Content-Type', req.headers.get('content-type') || 'application/json');
  if (connStr) headers.set('Neon-Connection-String', connStr);
  headers.set('Neon-Raw-Text-Output', req.headers.get('neon-raw-text-output') || 'true');
  headers.set('Neon-Array-Mode', req.headers.get('neon-array-mode') || 'true');

  const auth = req.headers.get('authorization');
  if (auth) headers.set('Authorization', auth);

  const batchIso = req.headers.get('neon-batch-isolation-level');
  if (batchIso) headers.set('Neon-Batch-Isolation-Level', batchIso);

  try {
    const upstream = await fetch(`https://${targetHost}/sql`, {
      method: 'POST',
      headers,
      body,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
