import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

const publicShellFiles = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']

function appShellWorker() {
  return {
    name: 'perfect-day-app-shell',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const source = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8')
        const shellFiles = ['index.html', ...publicShellFiles, ...Object.keys(bundle).filter(file => file.startsWith('assets/')).sort()]
        const hash = createHash('sha256').update(source).update(JSON.stringify(shellFiles)).update(bundle['index.html'].source)
        for (const file of publicShellFiles) hash.update(readFileSync(new URL('./public/' + file, import.meta.url)))
        const buildId = hash.digest('hex').slice(0, 16)
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: `const shellFiles = ${JSON.stringify(shellFiles)};\nconst buildId = "${buildId}";\n${source}`,
        })
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_')

  return {
    plugins: [vue(), appShellWorker()],
    server: {
      proxy: {
        '/api': {
          target: env.API_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
