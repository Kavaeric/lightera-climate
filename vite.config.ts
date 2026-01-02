import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'
import json5Plugin from 'vite-plugin-json5'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    glsl(),
    json5Plugin({
      include: ['**/*.jsonc'],
    }),
  ],
  base: '/lightera-climate/',
})
