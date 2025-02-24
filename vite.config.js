import fs from 'fs'
import path from 'path'

import { defineConfig } from 'vite'

function getHandlerEntries(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((file) => file.isDirectory())
    .reduce((entries, file) => {
      const handlerPath = path.join(dir, file.name, 'handler.js')
      if (fs.existsSync(handlerPath)) {
        return {
          ...entries,
          [`${file.name}/handler`]: path.resolve(__dirname, handlerPath)
        }
      }

      return entries
    }, {})
}

const handlerEntries = getHandlerEntries('./serverless/src')

export default defineConfig({
  build: {
    lib: {
      entry: handlerEntries,
      formats: ['cjs'],
      fileName: (format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      external: [
        'aws-sdk'
        // Add other external dependencies here
      ]
    },
    outDir: 'dist',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'serverless/src')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['serverless/src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      enabled: true,
      include: [
        'serverless/src/**/*.js'
      ],
      provider: 'istanbul',
      reporter: ['text', 'lcov', 'clover', 'json'],
      reportOnFailure: true
    }

  }
})
