import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default defineConfig({
  // Same "@" alias as the app build.
  resolve: viteConfig.resolve,
  test: {
    include: ['tests/unit/**/*.test.ts'],
    // Files that need the DOM or web storage opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
})
