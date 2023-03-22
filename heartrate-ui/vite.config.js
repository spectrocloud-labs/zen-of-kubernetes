import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default (configEnv) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(configEnv.mode, process.cwd(), '') }

  return defineConfig({
    base: process.env.VITE_APP_BASE_URL,
    plugins: [
      react()
    ]
  })
}
