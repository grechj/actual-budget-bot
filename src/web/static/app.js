const accountSelect = document.querySelector('#accountId');
const providerSelect = document.querySelector('#provider');
const modelInput = document.querySelector('#model');
const startDateInput = document.querySelector('#startDate');
const endDateInput = document.querySelector('#endDate');
const csvFileInput = document.querySelector('#csvFile');
const ocrFileInput = document.querySelector('#ocrFile');
const csvOutput = document.querySelector('#csvOutput');
const ocrOutput = document.querySelector('#ocrOutput');
const importOutput = document.querySelector('#importOutput');
const activePreview = document.querySelector('#activePreview');
const chatOutput = document.querySelector('#chatOutput');
const questionInput = document.querySelector('#question');

let currentPreview = null;

document.querySelector('#refreshAccounts').addEventListener('click', loadAccounts);
document.querySelector('#askButton').addEventListener('click', askBot);
document.querySelector('#dryRunButton').addEventListener('click', () => importToActual({ dryRun: true }));
document.querySelector('#commitButton').addEventListener('click', () => importToActual({ dryRun: false }));
csvFileInput.addEventListener('change', () => uploadPreview('/api/csv-preview', csvFileInput.files[0], csvOutput, 'CSV'));
ocrFileInput.addEventListener('change', () => uploadPreview('/api/ocr-preview', ocrFileInput.files[0], ocrOutput, 'OCR'));

setupDropzone('#csvDrop', csvFileInput);
setupDropzone('#ocrDrop', ocrFileInput);
updateImportButtons();
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
    updateImportButtons();
  }
}

async function uploadPreview(path, file, output, sourceLabel) {
  if (!file) {
    return;
  }

  output.textContent = `Reading ${file.name}...`;
  const form = new FormData();
  form.append('file', file);

  try {
    const response = await fetch(path, { method: 'POST', body: form });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Preview failed.');
    }

    currentPreview = {
      sourceLabel,
      fileName: file.name,
      transactions: data.transactions ?? [],
    };
    renderPreview(output, data, { sourceLabel, fileName: file.name });
    setActivePreview();
  } catch (error) {
    output.textContent = error.message;
  }
}

function renderPreview(container, data, meta) {
  container.replaceChildren(
    summaryBlock(data.summary, meta),
    transactionTable(data.transactions ?? []),
    issueList(data.issues ?? []),
    rawTextBlock(data.rawText),
  );
}

function summaryBlock(summary = {}, meta = {}) {
  const block = document.createElement('div');
  block.className = 'summary-block';
  block.append(
    pill(`${meta.sourceLabel}: ${meta.fileName}`),
    pill(`${summary.importedRows ?? 0} parsed`),
    pill(`${summary.issueCount ?? 0} issues`),
  );

  if (summary.duplicateRows) {
    block.append(pill(`${summary.duplicateRows} duplicates`));
  }

  return block;
}

function transactionTable(transactions) {
  if (transactions.length === 0) {
    return emptyState('No transactions parsed yet.');
  }

  const table = document.createElement('table');
  table.innerHTML = [
    '<thead><tr><th>Date</th><th>Description</th><th class="amount">Amount</th><th>Source</th></tr></thead>',
    '<tbody></tbody>',
  ].join('');
  const body = table.querySelector('tbody');

  for (const transaction of transactions.slice(0, 50)) {
    const row = document.createElement('tr');
    row.append(
      cell(transaction.date),
      cell(transaction.description),
      cell(formatAmount(transaction.amount), 'amount'),
      cell(sourceLabel(transaction.source)),
    );
    body.append(row);
  }

  if (transactions.length > 50) {
    const row = document.createElement('tr');
    const more = cell(`${transactions.length - 50} more rows not shown`);
    more.colSpan = 4;
    row.append(more);
    body.append(row);
  }

  return table;
}

function issueList(issues) {
  if (issues.length === 0) {
    return emptyState('No issues found.');
  }

  const list = document.createElement('ul');
  list.className = 'issues';

  for (const issue of issues.slice(0, 20)) {
    const item = document.createElement('li');
    item.textContent = `Line ${issue.lineNumber ?? issue.rowNumber ?? '-'}: ${issue.message}`;
    list.append(item);
  }

  return list;
}

function rawTextBlock(rawText) {
  if (!rawText) {
    return document.createDocumentFragment();
  }

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  const pre = document.createElement('pre');
  summary.textContent = 'Show OCR text';
  pre.textContent = rawText;
  details.append(summary, pre);
  return details;
}

async function importToActual({ dryRun }) {
  if (!currentPreview?.transactions?.length) {
    importOutput.textContent = 'Preview a CSV or screenshot first.';
    return;
  }

  if (!accountSelect.value) {
    importOutput.textContent = 'Choose an Actual Budget account first.';
    return;
  }

  if (!dryRun && !window.confirm(`Commit ${currentPreview.transactions.length} transactions to Actual Budget?`)) {
    return;
  }

  importOutput.textContent = dryRun ? 'Running dry run...' : 'Committing to Actual...';

  try {
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: accountSelect.value,
        transactions: currentPreview.transactions,
        dryRun,
        confirm: !dryRun,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Import failed.');
    }

    renderImportResult(data);
  } catch (error) {
    importOutput.textContent = error.message;
  }
}

function renderImportResult(data) {
  const result = data.result ?? {};
  importOutput.replaceChildren(
    summaryBlock({
      importedRows: data.attemptedRows,
      issueCount: result.errors?.length ?? 0,
    }, {
      sourceLabel: data.dryRun ? 'Dry run' : 'Committed',
      fileName: currentPreview?.fileName ?? 'preview',
    }),
    emptyState([
      `${result.addedCount ?? 0} ${data.dryRun ? 'would be added' : 'added'}`,
      `${result.updatedCount ?? 0} ${data.dryRun ? 'would be updated' : 'updated'}`,
      `${result.updatedPreviewCount ?? 0} possible updates`,
    ].join(' | ')),
    issueList((result.errors ?? []).map((message) => ({ message }))),
  );
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

    chatOutput.textContent = data.content || data.error || 'No response.';
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

function setActivePreview() {
  const count = currentPreview?.transactions?.length ?? 0;
  activePreview.textContent = count
    ? `${count} ${currentPreview.sourceLabel} transactions ready from ${currentPreview.fileName}.`
    : 'No parsed transactions ready to import.';
  updateImportButtons();
}

function updateImportButtons() {
  const disabled = !currentPreview?.transactions?.length;
  document.querySelector('#dryRunButton').disabled = disabled;
  document.querySelector('#commitButton').disabled = disabled;
}

function optionFor(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function pill(text) {
  const element = document.createElement('span');
  element.className = 'pill';
  element.textContent = text;
  return element;
}

function cell(text, className = '') {
  const element = document.createElement('td');
  element.className = className;
  element.textContent = text ?? '';
  return element;
}

function emptyState(text) {
  const element = document.createElement('p');
  element.className = 'empty';
  element.textContent = text;
  return element;
}

function formatAmount(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount ?? 0);
}

function sourceLabel(source = {}) {
  if (source.type === 'ocr') {
    return `OCR line ${source.lineNumber ?? '-'}`;
  }

  if (source.type === 'csv') {
    return `CSV row ${source.rowNumber ?? '-'}`;
  }

  return source.type ?? '';
}
