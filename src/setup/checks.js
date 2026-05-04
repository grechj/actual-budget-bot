import { spawn } from 'node:child_process';

export async function commandExists(command) {
  const check = process.platform === 'win32'
    ? ['where', [command]]
    : ['sh', ['-lc', `command -v ${shellQuote(command)}`]];

  const result = await run(check[0], check[1]);
  return result.code === 0;
}

export async function checkHttp(url) {
  try {
    const response = await fetch(url, { method: 'GET' });
    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? 'Reachable' : `Returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      message: error.message,
    };
  }
}

export async function run(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
      shell: options.shell || false,
    });
    const stdout = [];
    const stderr = [];

    child.stdout?.on('data', (chunk) => stdout.push(chunk));
    child.stderr?.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => {
      resolve({
        code: 1,
        stdout: '',
        stderr: error.message,
      });
    });
    child.on('close', (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}
