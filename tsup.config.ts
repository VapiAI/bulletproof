import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node18',
  splitting: false,
  treeshake: true,
  bundle: true,
  platform: 'node',
  external: ['@anthropic-ai/claude-agent-sdk'],
})
