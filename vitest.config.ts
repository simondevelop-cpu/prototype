import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Note: @vitejs/plugin-react will be added when installing dependencies
  // plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // For React Testing Library
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '.next/**',
        '**/__mocks__/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

