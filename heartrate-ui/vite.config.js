import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default (configEnv) => {
  return defineConfig({
    plugins: [
      react()
    ],
    build: {
      rollupOptions: {
        external: ['/js-dos.js']
      }
    }
  })
}
