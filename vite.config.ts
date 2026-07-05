import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore - @tailwindcss/vite no tiene tipos TypeScript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
