import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEnvFile, parseEnvFile } from '../src/config/envFile.js';

test('parses simple quoted and unquoted env values', () => {
  assert.deepEqual(parseEnvFile([
    '# comment',
    'ACTUAL_SERVER_URL=http://localhost:5006',
    'ACTUAL_PASSWORD="secret with spaces"',
    "ACTUAL_BUDGET_ID='budget-id'",
  ].join('\n')), {
    ACTUAL_SERVER_URL: 'http://localhost:5006',
    ACTUAL_PASSWORD: 'secret with spaces',
    ACTUAL_BUDGET_ID: 'budget-id',
  });
});

test('formats env values with useful sections', () => {
  const text = formatEnvFile({
    AB_BOT_DATA_DIR: '.ab-bot/actual-data',
    ACTUAL_PASSWORD: 'secret with spaces',
  });

  assert.match(text, /# AB Bot local storage/);
  assert.match(text, /AB_BOT_DATA_DIR=.ab-bot\/actual-data/);
  assert.match(text, /ACTUAL_PASSWORD="secret with spaces"/);
});
