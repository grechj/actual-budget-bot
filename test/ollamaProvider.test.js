import test from 'node:test';
import assert from 'node:assert/strict';
import { OllamaProvider } from '../src/index.js';

test('Ollama provider sends structured budget context to chat API shape', async () => {
  const calls = [];
  const provider = new OllamaProvider({
    model: 'test-local-model',
    baseUrl: 'http://localhost:11434',
    createResponse: async (payload) => {
      calls.push(payload);
      return {
        message: {
          role: 'assistant',
          content: 'Local model summary.',
        },
        prompt_eval_count: 12,
        eval_count: 8,
        total_duration: 123,
      };
    },
  });

  const response = await provider.generateResponse('How am I doing?', {
    transactionSummary: {
      totals: { income: 1000, spending: 500, net: 500 },
    },
  });

  assert.equal(response.provider, 'ollama');
  assert.equal(response.model, 'test-local-model');
  assert.equal(response.content, 'Local model summary.');
  assert.equal(calls[0].baseUrl, 'http://localhost:11434');
  assert.equal(calls[0].body.model, 'test-local-model');
  assert.equal(calls[0].body.stream, false);
  assert.match(calls[0].body.messages[1].content, /Structured budget context/);
});
