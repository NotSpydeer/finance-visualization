import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin to remove type="module" and crossorigin attributes from HTML
// so the built file can be opened directly via file:// protocol
function removeModuleAttributes(): Plugin {
  return {
    name: 'remove-module-attributes',
    enforce: 'post',
    apply: 'build',
    transformIndexHtml(html) {
      return html
        .replace(/ type="module"/g, '')
        .replace(/ crossorigin/g, '')
        .replace(/<script src="/g, '<script defer src="')
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), removeModuleAttributes()],
  base: command === 'build' ? './' : '/',
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
}))
