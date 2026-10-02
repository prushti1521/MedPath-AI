import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfflineMedicalAnswer, DEFAULT_GROQ_MODEL, getPrimaryAiProvider } from './ai.routes.js';

test('offline answer stays supportive and non-diagnostic for symptom questions', () => {
  const answer = buildOfflineMedicalAnswer([
    { role: 'user', content: 'I have chest pain and trouble breathing' },
  ]);

  assert.match(answer, /urgent|emergency|ER|seek urgent care/i);
  assert.match(answer, /educational|not a diagnosis|medical advice/i);
});

test('offline answer offers general guidance for routine questions', () => {
  const answer = buildOfflineMedicalAnswer([
    { role: 'user', content: 'What causes fatigue and headaches?' },
  ]);

  assert.match(answer, /common causes|possible causes|fatigue|headache/i);
  assert.match(answer, /clinician|healthcare professional/i);
});

test('offline answer explains asthma rather than returning generic symptom causes', () => {
  const answer = buildOfflineMedicalAnswer([
    { role: 'user', content: 'What is asthma in simple terms?' },
  ]);

  assert.match(answer, /airways.*inflamed|inflamed.*airways/i);
  assert.match(answer, /wheezing|coughing|shortness of breath/i);
  assert.doesNotMatch(answer, /common causes can include stress, infections/i);
});

test('offline answer is transparent when no supported topic matches', () => {
  const answer = buildOfflineMedicalAnswer([
    { role: 'user', content: 'Can you explain a rare endocrine disorder?' },
  ]);

  assert.match(answer, /can't generate a tailored answer/i);
  assert.match(answer, /healthcare professional/i);
});

test('Groq is preferred when a Groq key is configured', () => {
  assert.equal(getPrimaryAiProvider({ groqKey: 'set', geminiKey: 'set' }), 'groq');
});

test('Groq defaults to a model available on the free plan', () => {
  assert.equal(DEFAULT_GROQ_MODEL, 'openai/gpt-oss-20b');
});

test('provider selection falls back to Gemini, Anthropic, then offline', () => {
  assert.equal(getPrimaryAiProvider({ geminiKey: 'set' }), 'gemini');
  assert.equal(getPrimaryAiProvider({ anthropicKey: 'set' }), 'anthropic');
  assert.equal(getPrimaryAiProvider({}), 'offline');
});
