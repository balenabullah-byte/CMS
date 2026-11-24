import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
const proxy = { '/api': process.env.CAMPUS_API_ORIGIN || 'http://127.0.0.1:3000' }
export default defineConfig({
  plugins: [vue(), tailwindcss(), vueDevTools()],
  server: { proxy },
  preview: { proxy },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
