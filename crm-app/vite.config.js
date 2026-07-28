import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // host: true binds 0.0.0.0 so phones on the LAN can reach it.
  // allowedHosts: true lets a tunnel domain (trycloudflare.com, ngrok, etc.)
  // pass Vite's Host-header check. Both apply to `dev` and `preview`.
  server: { host: true, allowedHosts: true },
  preview: { host: true, allowedHosts: true },
})
