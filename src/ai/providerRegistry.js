import { DisabledAIProvider } from './provider.js';
import { OpenAIProvider } from './openaiProvider.js';
import { OllamaProvider } from './ollamaProvider.js';

const providerFactories = new Map([
  ['disabled', (config) => new DisabledAIProvider(config)],
  ['openai', (config) => new OpenAIProvider(config)],
  ['anthropic', () => unsupportedProvider('anthropic')],
  ['ollama', (config) => new OllamaProvider(config)],
]);

export function listAIProviders() {
  return [...providerFactories.keys()].map((id) => ({
    id,
    available: id === 'disabled' || id === 'openai' || id === 'ollama',
  }));
}

export function createAIProvider(config = {}) {
  const providerId = config.provider || 'disabled';
  const factory = providerFactories.get(providerId);

  if (!factory) {
    throw new Error(`Unknown AI provider "${providerId}". Available providers: ${[...providerFactories.keys()].join(', ')}`);
  }

  return factory(config);
}

export function loadAIConfig(env = process.env, overrides = {}) {
  const provider = overrides.provider || env.AB_BOT_AI_PROVIDER || 'disabled';
  const baseUrl = overrides.baseUrl || env.OLLAMA_BASE_URL;
  const config = {
    provider,
    model: overrides.model || env.AB_BOT_AI_MODEL || providerModelFromEnv(provider, env) || defaultModelFor(provider),
  };

  if (provider === 'ollama' || baseUrl) {
    config.baseUrl = baseUrl;
  }

  return config;
}

function providerModelFromEnv(provider, env) {
  if (provider === 'openai') {
    return env.OPENAI_MODEL;
  }

  if (provider === 'ollama') {
    return env.OLLAMA_MODEL;
  }

  return undefined;
}

function defaultModelFor(provider) {
  if (provider === 'openai') {
    return 'gpt-5.2';
  }

  if (provider === 'ollama') {
    return 'llama3.1';
  }

  return null;
}

function unsupportedProvider(provider) {
  return {
    async generateResponse() {
      throw new Error(`The ${provider} provider is registered but not implemented yet.`);
    },
  };
}
