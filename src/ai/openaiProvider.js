import { AIProvider } from './provider.js';

export class OpenAIProvider extends AIProvider {
  constructor(options = {}) {
    super();
    this.model = options.model || process.env.AB_BOT_AI_MODEL || process.env.OPENAI_MODEL || 'gpt-5.2';
    this.createResponse = options.createResponse || createDefaultResponse;
  }

  async generateResponse(prompt, context = {}) {
    const response = await this.createResponse({
      model: this.model,
      instructions: [
        'You are AB Bot, a cautious personal-budget assistant.',
        'Use only the structured budget context provided.',
        'Do not claim certainty where the data is incomplete.',
        'Give practical recommendations, but do not tell the user that a financial decision is guaranteed.',
        'Keep the answer concise and action-oriented.',
      ].join(' '),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                `Question: ${prompt}`,
                'Structured budget context:',
                JSON.stringify(context, null, 2),
              ].join('\n\n'),
            },
          ],
        },
      ],
    });

    return {
      content: response.output_text || extractOutputText(response),
      usage: response.usage || null,
      model: this.model,
      provider: 'openai',
    };
  }
}

async function createDefaultResponse(payload) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to use the OpenAI provider.');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed with ${response.status}: ${body}`);
  }

  return response.json();
}

function extractOutputText(response) {
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('\n');
}
