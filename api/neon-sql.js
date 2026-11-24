import https from 'https';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const connStr = req.headers['neon-connection-string'] || process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
  let targetHost = 'api.c-2.ap-southeast-1.aws.neon.tech';
  if (connStr) {
    try {
      const url = new URL(connStr);
      targetHost = url.hostname.replace(/^[^.]+\./, 'api.');
    } catch (_) {}
  }

  let body = '';
  if (typeof req.body === 'string') {
    body = req.body;
  } else if (req.body && typeof req.body === 'object') {
    body = JSON.stringify(req.body);
  } else {
    await new Promise((resolve) => {
      req.on('data', chunk => { body += chunk; });
      req.on('end', resolve);
    });
  }

  const options = {
    hostname: targetHost,
    port: 443,
    path: '/sql',
    method: 'POST',
    headers: {
      'Host': targetHost,
      'Content-Type': req.headers['content-type'] || 'application/json',
      'Neon-Connection-String': connStr,
      'Neon-Raw-Text-Output': req.headers['neon-raw-text-output'] || 'true',
      'Neon-Array-Mode': req.headers['neon-array-mode'] || 'true',
    }
  };

  if (req.headers['authorization']) {
    options.headers['Authorization'] = req.headers['authorization'];
  }
  if (req.headers['neon-batch-isolation-level']) {
    options.headers['Neon-Batch-Isolation-Level'] = req.headers['neon-batch-isolation-level'];
  }

  return new Promise((resolve) => {
    const proxyReq = https.request(options, (neonRes) => {
      res.writeHead(neonRes.statusCode, neonRes.headers);
      neonRes.pipe(res);
      neonRes.on('end', resolve);
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({ error: err.message });
      resolve();
    });

    proxyReq.write(body);
    proxyReq.end();
  });
}
