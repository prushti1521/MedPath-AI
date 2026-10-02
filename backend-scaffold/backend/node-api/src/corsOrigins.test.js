import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin } from './corsOrigins.js';

const allowedOrigins = [
  'https://medpath-ai-frontend-project.vercel.app',
  'http://localhost:5178',
];

test('allows configured origins, project Vercel deployments, and server requests', () => {
  assert.equal(isAllowedOrigin('https://medpath-ai-frontend-project.vercel.app', allowedOrigins), true);
  assert.equal(isAllowedOrigin('https://medpath-ai-frontend-project-cz8axc1i9-prushti.vercel.app', allowedOrigins), true);
  assert.equal(isAllowedOrigin('https://medpath-ai-frontend-project-git-main-prushti.vercel.app', allowedOrigins), true);
  assert.equal(isAllowedOrigin('http://localhost:5178', allowedOrigins), true);
  assert.equal(isAllowedOrigin(undefined, allowedOrigins), true);
});

test('rejects unrelated or lookalike origins', () => {
  assert.equal(isAllowedOrigin('https://example.com', allowedOrigins), false);
  assert.equal(isAllowedOrigin('https://medpath-ai-frontend-project.attacker.example', allowedOrigins), false);
  assert.equal(isAllowedOrigin('https://other-project-cz8axc1i9-prushti.vercel.app', allowedOrigins), false);
});