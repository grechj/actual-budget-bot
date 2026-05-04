const accountSelect = document.querySelector('#accountId');
const providerSelect = document.querySelector('#provider');
const modelInput = document.querySelector('#model');
const startDateInput = document.querySelector('#startDate');
const endDateInput = document.querySelector('#endDate');
const csvFileInput = document.querySelector('#csvFile');
const ocrFileInput = document.querySelector('#ocrFile');
const csvOutput = document.querySelector('#csvOutput');
const ocrOutput = document.querySelector('#ocrOutput');
const chatOutput = document.querySelector('#chatOutput');
const questionInput = document.querySelector('#question');

document.querySelector('#refreshAccounts').addEventListener('click', loadAccounts);
document.querySelector('#askButton').addEventListener('click', askBot);
csvFileInput.addEventListener('change', () => uploadFile('/api/csv-preview', csvFileInput.files[0], csvOutput));
ocrFileInput.addEventListener('change', () => uploadFile('/api/ocr-preview', ocrFileInput.files[0], ocrOutput));

setupDropzone('#csvDrop', csvFileInput);
setupDropzone('#ocrDrop', ocrFileInput);
loadProviders();
loadAccounts();

async function loadProviders() {
  const data = await fetchJson('/api/providers');
  providerSelect.replaceChildren(...data.providers.map((provider) => {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.available ? provider.id : `${provider.id} (not ready)`;
    option.disabled = !provider.available;
    return option;
  }));

  providerSelect.value = 'disabled';
}

async function loadAccounts() {
  accountSelect.disabled = true;
  accountSelect.replaceChildren(optionFor('', 'Loading accounts...'));

  try {
    const data = await fetchJson('/api/accounts');
    accountSelect.replaceChildren(
      optionFor('', 'Choose an account'),
      ...data.accounts.map((account) => optionFor(account.id, account.name)),
    );
  } catch (error) {
    accountSelect.replaceChildren(optionFor('', 'Actual Budget is not connected'));
    chatOutput.textContent = error.message;
  } finally {
    accountSelect.disabled = false;
  }
}

async function uploadFile(path, file, output) {
  if (!file) {
    return;
  }

  output.textContent = `Reading ${file.name}...`;
  const form = new FormData();
  form.append('file', file);

  try {
    const response = await fetch(path, { method: 'POST', body: form });
    output.textContent = formatJson(await response.json());
  } catch (error) {
    output.textContent = error.message;
  }
}

async function askBot() {
  const question = questionInput.value.trim();

  if (!question) {
    chatOutput.textContent = 'Type a question first.';
    return;
  }

  if (!accountSelect.value) {
    chatOutput.textContent = 'Choose an Actual Budget account first.';
    return;
  }

  chatOutput.textContent = 'Thinking...';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        accountId: accountSelect.value,
        startDate: startDateInput.value,
        endDate: endDateInput.value,
        provider: providerSelect.value,
        model: modelInput.value.trim() || undefined,
      }),
    });
    const data = await response.json();

    chatOutput.textContent = data.content || data.error || formatJson(data);
  } catch (error) {
    chatOutput.textContent = error.message;
  }
}

function setupDropzone(selector, input) {
  const dropzone = document.querySelector(selector);

  for (const eventName of ['dragenter', 'dragover']) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragging');
    });
  }

  for (const eventName of ['dragleave', 'drop']) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragging');
    });
  }

  dropzone.addEventListener('drop', (event) => {
    input.files = event.dataTransfer.files;
    input.dispatchEvent(new Event('change'));
  });
}

async function fetchJson(path) {
  const response = await fetch(path);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

function optionFor(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}
