import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: [
            "./index.html",
            "./src/**/*.{js,ts,jsx,tsx}",
          ],
          corePlugins: {
            preflight: false,
          },
          theme: {
            extend: {
              backgroundImage: {
                "gradient-conic": "conic-gradient(var(--tw-gradient-stops))",
              },
            },
          },
        }),
        autoprefixer()
      ]
    }
  }
})
