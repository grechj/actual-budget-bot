import { AIProvider } from './provider.js';

export class OllamaProvider extends AIProvider {
  constructor(options = {}) {
    super();
    this.model = options.model || process.env.AB_BOT_AI_MODEL || process.env.OLLAMA_MODEL || 'llama3.1';
    this.baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.createResponse = options.createResponse || createDefaultResponse;
    this.listModelsResponse = options.listModelsResponse || createDefaultListModelsResponse;
  }

  async generateResponse(prompt, context = {}) {
    const response = await this.createResponse({
      baseUrl: this.baseUrl,
      body: {
        model: this.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: [
              'You are AB Bot, a cautious personal-budget assistant.',
              'Use only the structured budget context provided.',
              'Do not claim certainty where the data is incomplete.',
              'Keep recommendations practical, concise, and advisory.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              `Question: ${prompt}`,
              'Structured budget context:',
              JSON.stringify(context, null, 2),
            ].join('\n\n'),
          },
        ],
      },
    });

    return {
      content: response.message?.content || response.response || '',
      usage: {
        promptEvalCount: response.prompt_eval_count ?? null,
        evalCount: response.eval_count ?? null,
        totalDuration: response.total_duration ?? null,
      },
      model: this.model,
      provider: 'ollama',
    };
  }

  async listModels() {
    const response = await this.listModelsResponse({ baseUrl: this.baseUrl });

    return response.models?.map((model) => ({
      name: model.name,
      size: model.size ?? null,
      modifiedAt: model.modified_at ?? null,
    })) ?? [];
  }
}

async function createDefaultResponse({ baseUrl, body }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatOllamaError(response.status, text, body.model));
  }

  return response.json();
}

async function createDefaultListModelsResponse({ baseUrl }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama model list failed with ${response.status}: ${text}`);
  }

  return response.json();
}

function formatOllamaError(status, text, model) {
  const message = parseOllamaErrorMessage(text);

  if (status === 404 && /model .* not found/i.test(message)) {
    return [
      `Ollama model "${model}" is not installed locally.`,
      `Run "ollama pull ${model}" or use "node src/cli.js ai:ollama-models" to see installed models.`,
    ].join(' ');
  }

  return `Ollama request failed with ${status}: ${text}`;
}

function parseOllamaErrorMessage(text) {
  try {
    return JSON.parse(text).error || text;
  } catch {
    return text;
  }
}
