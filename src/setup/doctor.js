import { loadAIConfig, loadActualConfig } from '../index.js';
import { commandExists, checkHttp } from './checks.js';

export async function runDoctor(env = process.env) {
  const actual = loadActualConfig(env);
  const ai = loadAIConfig(env);
  const checks = [];

  checks.push({
    name: 'Node.js',
    ok: Number.parseInt(process.versions.node.split('.')[0], 10) >= 20,
    detail: `v${process.versions.node}`,
  });

  checks.push({
    name: 'Actual server command',
    ok: await commandExists('actual-server'),
    detail: 'actual-server on PATH',
    fix: 'Install with: npm install --location=global @actual-app/sync-server',
  });

  if (actual.serverURL) {
    try {
      const health = await checkHttp(new URL('/account/needs-bootstrap', actual.serverURL).toString());
      checks.push({
        name: 'Actual server reachable',
        ok: health.ok,
        detail: `${actual.serverURL} (${health.message})`,
        fix: 'Start Actual with: ACTUAL_DATA_DIR=.ab-bot/actual-server actual-server',
      });
    } catch (error) {
      checks.push({
        name: 'Actual server reachable',
        ok: false,
        detail: `Invalid ACTUAL_SERVER_URL: ${error.message}`,
        fix: 'Use a full URL such as http://localhost:5006',
      });
    }
  } else {
    checks.push({
      name: 'Actual server URL',
      ok: false,
      detail: 'ACTUAL_SERVER_URL is not set',
      fix: 'Run: ab-bot setup',
    });
  }

  checks.push({
    name: 'Actual budget Sync ID',
    ok: Boolean(actual.budgetId),
    detail: actual.budgetId ? 'ACTUAL_BUDGET_ID is set' : 'ACTUAL_BUDGET_ID is missing',
    fix: 'Copy the Sync ID from Actual Settings -> Advanced.',
  });

  checks.push({
    name: 'Apple Vision OCR',
    ok: process.platform === 'darwin' && await commandExists(env.SWIFT_BIN || '/usr/bin/swift'),
    detail: process.platform === 'darwin' ? 'macOS Swift OCR path' : 'Only available on macOS',
  });

  checks.push({
    name: 'Tesseract OCR',
    ok: await commandExists(env.TESSERACT_BIN || 'tesseract'),
    detail: env.TESSERACT_BIN || 'tesseract',
    fix: 'Optional fallback. macOS: brew install tesseract',
  });

  checks.push({
    name: 'AI provider',
    ok: aiProviderReady(ai, env),
    detail: aiProviderDetail(ai, env),
    fix: 'Use disabled for local-only, ollama for local AI, or openai with OPENAI_API_KEY.',
  });

  return {
    ok: checks.every((check) => check.ok || optionalCheck(check.name)),
    checks,
  };
}

export function formatDoctorReport(report) {
  return [
    'AB Bot doctor',
    ...report.checks.map((check) => {
      const mark = check.ok ? 'OK' : optionalCheck(check.name) ? 'WARN' : 'FAIL';
      const fix = check.ok || !check.fix ? '' : `\n     ${check.fix}`;
      return `  [${mark}] ${check.name}: ${check.detail}${fix}`;
    }),
  ].join('\n');
}

function aiProviderReady(ai, env) {
  if (ai.provider === 'disabled') {
    return true;
  }

  if (ai.provider === 'openai') {
    return Boolean(env.OPENAI_API_KEY);
  }

  if (ai.provider === 'ollama') {
    return true;
  }

  return false;
}

function aiProviderDetail(ai, env) {
  if (ai.provider === 'openai') {
    return env.OPENAI_API_KEY ? `openai / ${ai.model}` : 'openai selected, OPENAI_API_KEY missing';
  }

  if (ai.provider === 'ollama') {
    return `ollama / ${ai.model} at ${ai.baseUrl || env.OLLAMA_BASE_URL || 'http://localhost:11434'}`;
  }

  return `${ai.provider || 'disabled'}${ai.model ? ` / ${ai.model}` : ''}`;
}

function optionalCheck(name) {
  return name === 'Apple Vision OCR' || name === 'Tesseract OCR';
}
