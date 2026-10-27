import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env from files (.env, .env.local) and process.env (Vercel deployment environment)
  const env = loadEnv(mode, process.cwd(), '')
  const dbUrl = env.DATABASE_URL || env.VITE_DATABASE_URL || process.env.DATABASE_URL || process.env.VITE_DATABASE_URL || ''

  return {
    plugins: [react()],
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
    }
  }
})

