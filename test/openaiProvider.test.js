import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIProvider } from '../src/index.js';

test('OpenAI provider sends structured budget context through Responses API', async () => {
  const calls = [];
  const provider = new OpenAIProvider({
    model: 'test-model',
    createResponse: async (payload) => {
      calls.push(payload);
      return {
        output: [
          {
            type: 'message',
            content: [
              { type: 'output_text', text: 'You spent less than planned.' },
            ],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 6 },
      };
    },
  });

  const response = await provider.generateResponse('How am I doing?', {
    transactionSummary: {
      totals: { income: 1000, spending: 500, net: 500 },
    },
  });

  assert.equal(response.content, 'You spent less than planned.');
  assert.equal(response.model, 'test-model');
  assert.equal(calls[0].model, 'test-model');
  assert.match(calls[0].input[0].content[0].text, /Structured budget context/);
});
