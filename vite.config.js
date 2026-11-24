import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import path from 'path'
import https from 'https'
import dns from 'dns'

function neonDevProxyPlugin() {
  const fallbackIps = ['18.138.49.39', '13.251.17.193', '3.0.167.45'];
  const resolver = new dns.promises.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);

  const handler = async (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const connStr = req.headers['neon-connection-string'] || '';
      let targetHost = 'api.c-2.ap-southeast-1.aws.neon.tech';
      if (connStr) {
        try {
          const url = new URL(connStr);
          targetHost = url.hostname.replace(/^[^.]+\./, 'api.');
        } catch (_) {}
      }

      let ip = fallbackIps[0];
      try {
        const resolved = await resolver.resolve4(targetHost);
        if (resolved && resolved.length > 0) {
          ip = resolved[0];
        }
      } catch (err) {
        ip = fallbackIps[0];
      }

      const options = {
        hostname: ip,
        port: 443,
        path: '/sql',
        method: 'POST',
        servername: targetHost,
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

      const proxyReq = https.request(options, (neonRes) => {
        res.writeHead(neonRes.statusCode, neonRes.headers);
        neonRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('[Neon Dev Proxy Error]:', err.message);
        res.statusCode = 502;
        res.end(JSON.stringify({ error: err.message }));
      });

      proxyReq.write(body);
      proxyReq.end();
    });
  };

  return {
    name: 'neon-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/neon-sql', handler);
      server.middlewares.use('/api/neon-sql', handler);
    }
  };
}

export default defineConfig(({ mode }) => {
  // Load env from files (.env, .env.local) and process.env (Vercel deployment environment)
  const env = loadEnv(mode, process.cwd(), '')
  const dbUrl = env.DATABASE_URL || env.VITE_DATABASE_URL || process.env.DATABASE_URL || process.env.VITE_DATABASE_URL || ''

  return {
    plugins: [react(), neonDevProxyPlugin()],
    define: {
      // Exposes DATABASE_URL to client code under import.meta.env.VITE_DATABASE_URL
      'import.meta.env.VITE_DATABASE_URL': JSON.stringify(dbUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    css: {
      postcss: {
        plugins: [
          tailwindcss(),
          autoprefixer()
        ]
      }
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-clerk': ['@clerk/clerk-react'],
            'vendor-db': ['@neondatabase/serverless'],
          }
        }
      }
    }
  }
})
