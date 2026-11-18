import { defineConfig } from 'vitest/config';

/**
 * Testes do servidor MCP.
 *
 * Nenhum encosta no banco: não há `.env` aqui nem em CI, e um teste que
 * precisa da senha de produção é um teste que ninguém roda. O que está
 * coberto são as travas de segurança, que são funções puras de propósito —
 * ver src/seguranca.ts.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
