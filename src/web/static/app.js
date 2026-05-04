const accountSelect = document.querySelector('#accountId');
const providerSelect = document.querySelector('#provider');
const modelInput = document.querySelector('#model');
const startDateInput = document.querySelector('#startDate');
const endDateInput = document.querySelector('#endDate');
const csvProfileSelect = document.querySelector('#csvProfile');
const defaultCategorySelect = document.querySelector('#defaultCategory');
const csvFileInput = document.querySelector('#csvFile');
const ocrFileInput = document.querySelector('#ocrFile');
const csvOutput = document.querySelector('#csvOutput');
const ocrOutput = document.querySelector('#ocrOutput');
const importOutput = document.querySelector('#importOutput');
const activePreview = document.querySelector('#activePreview');
const chatOutput = document.querySelector('#chatOutput');
const questionInput = document.querySelector('#question');
const statusGrid = document.querySelector('#statusGrid');

let currentPreview = null;
let currentStatus = null;
let currentCategories = [];

document.querySelector('#refreshAccounts').addEventListener('click', refreshConnections);
document.querySelector('#refreshStatus').addEventListener('click', loadStatus);
document.querySelector('#askButton').addEventListener('click', askBot);
document.querySelector('#applyCategoryButton').addEventListener('click', applyDefaultCategoryToPreview);
document.querySelector('#dryRunButton').addEventListener('click', () => importToActual({ dryRun: true }));
document.querySelector('#commitButton').addEventListener('click', () => importToActual({ dryRun: false }));
csvFileInput.addEventListener('change', () => uploadPreview('/api/csv-preview', csvFileInput.files[0], csvOutput, 'CSV', {
  profile: csvProfileSelect.value,
}));
ocrFileInput.addEventListener('change', () => uploadPreview('/api/ocr-preview', ocrFileInput.files[0], ocrOutput, 'OCR'));

setupDropzone('#csvDrop', csvFileInput);
setupDropzone('#ocrDrop', ocrFileInput);
updateImportButtons();
loadProviders();
loadProfiles();
refreshConnections();

async function refreshConnections() {
  await loadStatus().catch(() => {});
  await loadBudgetMetadata();
}

async function loadStatus() {
  statusGrid.textContent = 'Checking local setup...';

  try {
    const data = await fetchJson('/api/status');
    currentStatus = data;
    renderStatus(data);
  } catch (error) {
    statusGrid.replaceChildren(statusCard('AB Bot', {
      ok: false,
      message: 'Could not check local setup.',
      details: error.message,
    }));
  }
}

function renderStatus(status) {
  statusGrid.replaceChildren(
    statusCard('Actual', status.actual),
    statusCard('CSV', status.profiles),
    statusCard('OCR', status.ocr),
    statusCard('AI', status.ai),
  );
}

function statusCard(fallbackLabel, item = {}) {
  const card = document.createElement('div');
  card.className = `status-card ${item.ok ? 'ok' : 'bad'}`;

  const label = document.createElement('strong');
  label.textContent = item.label || fallbackLabel;

  const message = document.createElement('p');
  message.textContent = item.message || 'Status unavailable.';

  const details = document.createElement('span');
  details.textContent = item.details || '';

  card.append(label, message, details);
  return card;
}

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

async function loadBudgetMetadata() {
  accountSelect.disabled = true;
  defaultCategorySelect.disabled = true;
  accountSelect.replaceChildren(optionFor('', 'Loading accounts...'));
  defaultCategorySelect.replaceChildren(optionFor('', 'Loading categories...'));

  try {
    const data = await fetchJson('/api/budget-metadata');
    currentCategories = data.categories ?? [];
    setActualStatus({
      ok: true,
      label: 'Actual Budget',
      message: `Budget loaded with ${data.accounts.length} account${data.accounts.length === 1 ? '' : 's'}.`,
      details: 'Connected',
    });
    accountSelect.replaceChildren(
      optionFor('', 'Choose an account'),
      ...data.accounts.map((account) => optionFor(account.id, account.name)),
    );
    renderDefaultCategorySelect();
    rerenderCurrentPreview();
  } catch (error) {
    currentCategories = [];
    setActualStatus({
      ok: false,
      label: 'Actual Budget',
      message: isRateLimitError(error)
        ? 'Actual is temporarily rate-limiting login attempts.'
        : 'Could not load the configured budget.',
      details: isRateLimitError(error)
        ? 'Wait a minute, then refresh accounts.'
        : error.message,
    });
    accountSelect.replaceChildren(optionFor('', 'Actual Budget is not connected'));
    defaultCategorySelect.replaceChildren(optionFor('', 'Categories unavailable'));
    chatOutput.textContent = error.message;
  } finally {
    accountSelect.disabled = false;
    defaultCategorySelect.disabled = false;
    updateImportButtons();
  }
}

function renderDefaultCategorySelect() {
  defaultCategorySelect.replaceChildren(
    optionFor('', 'Leave uncategorised'),
    ...categoryOptions(),
  );
}

function setActualStatus(actualStatus) {
  if (!currentStatus) {
    return;
  }

  currentStatus = {
    ...currentStatus,
    actual: actualStatus,
  };
  renderStatus(currentStatus);
}

function isRateLimitError(error) {
  return /too-many-requests/i.test(error.message);
}

async function loadProfiles() {
  try {
    const data = await fetchJson('/api/profiles');
    csvProfileSelect.replaceChildren(
      optionFor('', 'Auto-detect columns'),
      ...data.profiles.map((profile) => optionFor(profile.id, profile.name || profile.id)),
    );
  } catch (error) {
    csvProfileSelect.replaceChildren(optionFor('', 'No saved profiles found'));
  }
}

async function uploadPreview(path, file, output, sourceLabel, fields = {}) {
  if (!file) {
    return;
  }

  output.textContent = `Reading ${file.name}...`;
  const form = new FormData();
  form.append('file', file);

  for (const [key, value] of Object.entries(fields)) {
    if (value) {
      form.append(key, value);
    }
  }

  try {
    const response = await fetch(path, { method: 'POST', body: form });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Preview failed.');
    }

    currentPreview = {
      sourceLabel,
      fileName: file.name,
      output,
      summary: data.summary,
      issues: data.issues ?? [],
      rawText: data.rawText,
      transactions: (data.transactions ?? []).map((transaction) => ({ ...transaction })),
    };
    renderPreview(output, {
      ...data,
      transactions: currentPreview.transactions,
    }, { sourceLabel, fileName: file.name, editableCategories: true });
    setActivePreview();
  } catch (error) {
    output.replaceChildren(emptyState(error.message));
  }
}

function renderPreview(container, data, meta) {
  container.replaceChildren(
    summaryBlock(data.summary, meta),
    transactionTable(data.transactions ?? [], { editableCategories: meta.editableCategories }),
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

function transactionTable(transactions, options = {}) {
  if (transactions.length === 0) {
    return emptyState('No transactions parsed yet.');
  }

  const table = document.createElement('table');
  table.innerHTML = [
    `<thead><tr><th>Date</th><th>Description</th><th class="amount">Amount</th>${options.editableCategories ? '<th>Category</th>' : ''}<th>Source</th></tr></thead>`,
    '<tbody></tbody>',
  ].join('');
  const body = table.querySelector('tbody');

  transactions.forEach((transaction, index) => {
    const row = document.createElement('tr');
    row.append(
      cell(transaction.date),
      cell(transaction.description),
      cell(formatAmount(transaction.amount), 'amount'),
    );

    if (options.editableCategories) {
      row.append(categoryCell(index, transaction.category));
    }

    row.append(cell(sourceLabel(transaction.source)));
    body.append(row);
  });

  return table;
}

function categoryCell(index, selectedCategory) {
  const element = document.createElement('td');
  const select = document.createElement('select');
  select.className = 'category-select';
  select.replaceChildren(
    optionFor('', 'Uncategorised'),
    ...categoryOptions(),
  );
  select.value = selectedCategory || '';
  select.addEventListener('change', () => {
    currentPreview.transactions[index] = {
      ...currentPreview.transactions[index],
      category: select.value || null,
    };
    setActivePreview();
  });
  element.append(select);
  return element;
}

function categoryOptions() {
  return currentCategories
    .filter((category) => !category.hidden)
    .map((category) => optionFor(category.id, category.group ? `${category.group} / ${category.name}` : category.name));
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
  const transactions = transactionsForImport();

  try {
    const response = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: accountSelect.value,
        transactions,
        dryRun,
        confirm: !dryRun,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Import failed.');
    }

    renderImportResult(data);
    await loadStatus();
  } catch (error) {
    importOutput.textContent = error.message;
  }
}

function transactionsForImport() {
  if (!defaultCategorySelect.value) {
    return currentPreview.transactions;
  }

  return currentPreview.transactions.map((transaction) => ({
    ...transaction,
    category: transaction.category || defaultCategorySelect.value,
  }));
}

function applyDefaultCategoryToPreview() {
  if (!currentPreview?.transactions?.length) {
    importOutput.textContent = 'Preview a CSV or screenshot first.';
    return;
  }

  currentPreview.transactions = currentPreview.transactions.map((transaction) => ({
    ...transaction,
    category: defaultCategorySelect.value || null,
  }));
  rerenderCurrentPreview();
  setActivePreview();
}

function rerenderCurrentPreview() {
  if (!currentPreview?.output) {
    return;
  }

  renderPreview(currentPreview.output, {
    summary: currentPreview.summary,
    issues: currentPreview.issues,
    rawText: currentPreview.rawText,
    transactions: currentPreview.transactions,
  }, {
    sourceLabel: currentPreview.sourceLabel,
    fileName: currentPreview.fileName,
    editableCategories: true,
  });
}

function renderImportResult(data) {
  const result = data.result ?? {};
  const addedCount = result.addedCount ?? result.added?.length ?? 0;
  const updatedCount = result.updatedCount ?? result.updated?.length ?? 0;
  const updatedPreviewCount = result.updatedPreviewCount ?? result.updatedPreview?.length ?? 0;
  importOutput.replaceChildren(
    summaryBlock({
      importedRows: data.attemptedRows,
      issueCount: result.errors?.length ?? 0,
    }, {
      sourceLabel: data.dryRun ? 'Dry run' : 'Committed',
      fileName: currentPreview?.fileName ?? 'preview',
    }),
    importOutcomeMessage(data, { addedCount, updatedCount, updatedPreviewCount }),
    issueList((result.errors ?? []).map((message) => ({ message }))),
  );
}

function importOutcomeMessage(data, counts) {
  const message = document.createElement('div');
  message.className = `import-result ${data.dryRun ? 'dry-run' : 'committed'}`;
  const title = document.createElement('strong');
  const detail = document.createElement('p');
  title.textContent = data.dryRun ? 'Nothing was written to Actual.' : 'Transactions were sent to Actual.';
  detail.textContent = [
    `${counts.addedCount} ${data.dryRun ? 'would be added' : 'added'}`,
    `${counts.updatedCount} ${data.dryRun ? 'would be updated' : 'updated'}`,
    `${counts.updatedPreviewCount} possible updates`,
  ].join(' | ');
  message.append(title, detail);
  return message;
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

    if (!response.ok) {
      throw new Error(data.error || 'Chat request failed.');
    }

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
  const categorisedCount = currentPreview?.transactions?.filter((transaction) => transaction.category)?.length ?? 0;
  activePreview.textContent = count
    ? `${count} ${currentPreview.sourceLabel} transactions ready from ${currentPreview.fileName}. ${categorisedCount} categorised.`
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
