import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readEnvFile, writeEnvFile } from '../config/envFile.js';
import { commandExists, run } from './checks.js';
import { formatDoctorReport, runDoctor } from './doctor.js';

export async function runSetupWizard(options = {}) {
  const rl = createInterface({ input, output });

  try {
    console.log('AB Bot setup');
    console.log('This writes a local .env file. Keep it private.\n');

    const existing = await readEnvFile(options.envPath || '.env');
    const actualServerInstalled = await commandExists('actual-server');

    if (!actualServerInstalled) {
      console.log('Actual Budget sync server was not found on PATH.');
      const install = await confirm(rl, 'Install @actual-app/sync-server globally now?', false);

      if (install) {
        const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const result = await run(npmCommand, ['install', '--location=global', '@actual-app/sync-server'], { stdio: 'inherit' });
        if (result.code !== 0) {
          console.log('Install did not complete. You can retry later with: npm install --location=global @actual-app/sync-server');
        }
      }
    }

    const values = {
      AB_BOT_DATA_DIR: await ask(rl, 'AB Bot Actual data folder', existing.AB_BOT_DATA_DIR || '.ab-bot/actual-data'),
      AB_BOT_WEB_HOST: await ask(rl, 'Web UI host', existing.AB_BOT_WEB_HOST || '127.0.0.1'),
      AB_BOT_WEB_PORT: await ask(rl, 'Web UI port', existing.AB_BOT_WEB_PORT || '3000'),
      ACTUAL_SERVER_URL: await ask(rl, 'Actual server URL', existing.ACTUAL_SERVER_URL || 'http://localhost:5006'),
      ACTUAL_PASSWORD: await ask(rl, 'Actual server password', existing.ACTUAL_PASSWORD || ''),
      ACTUAL_BUDGET_ID: await ask(rl, 'Actual budget Sync ID', existing.ACTUAL_BUDGET_ID || ''),
      ACTUAL_BUDGET_PASSWORD: await ask(rl, 'Actual budget file password, if any', existing.ACTUAL_BUDGET_PASSWORD || ''),
    };

    const provider = await choose(rl, 'AI provider', [
      ['disabled', 'Disabled/local-only'],
      ['ollama', 'Ollama local AI'],
      ['openai', 'OpenAI cloud AI'],
    ], existing.AB_BOT_AI_PROVIDER || 'disabled');

    values.AB_BOT_AI_PROVIDER = provider;
    values.AB_BOT_AI_MODEL = await ask(rl, 'Default AI model override, optional', existing.AB_BOT_AI_MODEL || '');
    values.OPENAI_API_KEY = provider === 'openai'
      ? await ask(rl, 'OpenAI API key', existing.OPENAI_API_KEY || '')
      : existing.OPENAI_API_KEY || '';
    values.OPENAI_MODEL = await ask(rl, 'OpenAI model', existing.OPENAI_MODEL || 'gpt-5.2');
    values.OLLAMA_BASE_URL = await ask(rl, 'Ollama base URL', existing.OLLAMA_BASE_URL || 'http://localhost:11434');
    values.OLLAMA_MODEL = await ask(rl, 'Ollama model', existing.OLLAMA_MODEL || 'llama3.1');
    values.SWIFT_BIN = await ask(rl, 'Swift path for Apple Vision OCR', existing.SWIFT_BIN || '/usr/bin/swift');
    values.TESSERACT_BIN = await ask(rl, 'Tesseract command/path', existing.TESSERACT_BIN || 'tesseract');
    values.TESSERACT_LANG = await ask(rl, 'Tesseract language', existing.TESSERACT_LANG || 'eng');

    await writeEnvFile(values, options.envPath || '.env');
    Object.assign(process.env, values);

    console.log('\nSaved .env');
    console.log(formatDoctorReport(await runDoctor(process.env)));
    console.log('\nStart AB Bot with: ab-bot web');
  } finally {
    rl.close();
  }
}

async function ask(rl, question, defaultValue = '') {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue;
}

async function confirm(rl, question, defaultValue = false) {
  const answer = await rl.question(`${question} ${defaultValue ? '[Y/n]' : '[y/N]'}: `);
  const normalized = answer.trim().toLowerCase();

  if (!normalized) {
    return defaultValue;
  }

  return normalized === 'y' || normalized === 'yes';
}

async function choose(rl, question, choices, defaultValue) {
  console.log(question);
  choices.forEach(([value, label], index) => {
    const marker = value === defaultValue ? ' default' : '';
    console.log(`  ${index + 1}. ${label} (${value})${marker}`);
  });

  while (true) {
    const answer = await rl.question(`Choose 1-${choices.length} [${defaultValue}]: `);
    const trimmed = answer.trim();

    if (!trimmed) {
      return defaultValue;
    }

    const byNumber = choices[Number.parseInt(trimmed, 10) - 1]?.[0];
    const byValue = choices.find(([value]) => value === trimmed)?.[0];

    if (byNumber || byValue) {
      return byNumber || byValue;
    }

    console.log('Choose one of the listed options.');
  }
}
