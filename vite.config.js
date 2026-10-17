import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({ build: { rollupOptions: { input: { presentation: resolve('index.html'), workspace: resolve('workspace.html') } } } });
