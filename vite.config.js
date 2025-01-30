import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import rollupNodePolyFill from 'rollup-plugin-polyfill-node'
import { ViteEjsPlugin } from 'vite-plugin-ejs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
    ViteEjsPlugin({
      environment: process.env.NODE_ENV || 'development'
    })
  ],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, 'static/src')
      }
    ]
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    rollupOptions: {
      plugins: [
        rollupNodePolyFill()
      ]
    }
  },
  css: {
    devSourcemap: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: 'test-setup.js',
    clearMocks: true,
    coverage: {
      enabled: true,
      include: [
        'serverless/src/**/*.js',
        'static/src/**/*.js',
        'static/src/**/*.jsx'
      ],
      provider: 'istanbul',
      reporter: ['text', 'lcov', 'clover', 'json'],
      reportOnFailure: true
    }
  },
  server: {
    proxy: {
      '/rdf4j-server': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }

})
