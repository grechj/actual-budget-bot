import test from 'node:test';
import assert from 'node:assert/strict';
import { createAIProvider, listAIProviders, loadAIConfig } from '../src/index.js';

test('lists registered AI providers', () => {
  const providers = listAIProviders();

  assert.deepEqual(providers.map((provider) => provider.id), ['disabled', 'openai', 'anthropic', 'ollama']);
  assert.equal(providers.find((provider) => provider.id === 'disabled').available, true);
  assert.equal(providers.find((provider) => provider.id === 'ollama').available, false);
});

test('loads AI config from env with overrides', () => {
  const config = loadAIConfig({
    AB_BOT_AI_PROVIDER: 'openai',
    AB_BOT_AI_MODEL: 'env-model',
  }, {
    model: 'override-model',
  });

  assert.deepEqual(config, {
    provider: 'openai',
    model: 'override-model',
  });
});

test('creates disabled provider by default', async () => {
  const provider = createAIProvider(loadAIConfig({}));
  const response = await provider.generateResponse('hello', {});

  assert.equal(response.provider, 'disabled');
  assert.match(response.content, /not configured/);
});

test('unknown AI provider fails clearly', () => {
  assert.throws(() => createAIProvider({ provider: 'mystery' }), /Unknown AI provider/);
});
