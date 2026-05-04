import { DisabledAIProvider } from './provider.js';
import { OpenAIProvider } from './openaiProvider.js';

const providerFactories = new Map([
  ['disabled', (config) => new DisabledAIProvider(config)],
  ['openai', (config) => new OpenAIProvider(config)],
  ['anthropic', () => unsupportedProvider('anthropic')],
  ['ollama', () => unsupportedProvider('ollama')],
]);

export function listAIProviders() {
  return [...providerFactories.keys()].map((id) => ({
    id,
    available: id === 'disabled' || id === 'openai',
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

  return {
    provider,
    model: overrides.model || env.AB_BOT_AI_MODEL || env.OPENAI_MODEL || defaultModelFor(provider),
  };
}

function defaultModelFor(provider) {
  if (provider === 'openai') {
    return 'gpt-5.2';
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
