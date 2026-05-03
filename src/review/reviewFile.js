import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createImportedId } from '../ingestion/dedupe.js';
import { formatCsvPreview } from '../preview/format.js';
import { ensureDir, getReviewsDir } from '../storage/paths.js';

export function createReview(preview, options = {}) {
  const now = new Date().toISOString();
  const id = options.id || createReviewId(now);

  return {
    version: 1,
    id,
    createdAt: now,
    status: 'needs_review',
    source: {
      type: 'csv',
      fileName: options.sourceFile ? basename(options.sourceFile) : null,
      profile: options.profileName || null,
    },
    summary: formatCsvPreview(preview, { summaryOnly: true }).summary,
    issues: preview.issues,
    duplicates: formatCsvPreview(preview, { summaryOnly: true }).duplicates,
    transactions: preview.transactions.map((transaction) => ({
      ...transaction,
      imported_id: createImportedId(transaction),
      review: {
        status: 'pending',
        notes: null,
      },
    })),
  };
}

export async function saveReview(review, filePath = null) {
  const targetPath = filePath || join(await ensureDir(getReviewsDir()), `${review.id}.json`);
  await writeFile(targetPath, `${JSON.stringify(review, null, 2)}\n`, 'utf8');
  return targetPath;
}

export async function loadReview(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export function approveAll(review) {
  return {
    ...review,
    status: 'approved',
    transactions: review.transactions.map((transaction) => ({
      ...transaction,
      review: {
        ...(transaction.review || {}),
        status: transaction.review?.status === 'rejected' ? 'rejected' : 'approved',
      },
    })),
  };
}

export function getApprovedTransactions(review) {
  return review.transactions.filter((transaction) => transaction.review?.status === 'approved');
}

export function summarizeReview(review, options = {}) {
  const limit = options.limit ?? 10;
  const approved = getApprovedTransactions(review);
  const pending = review.transactions.filter((transaction) => transaction.review?.status === 'pending');
  const rejected = review.transactions.filter((transaction) => transaction.review?.status === 'rejected');

  return {
    id: review.id,
    status: review.status,
    source: review.source,
    summary: {
      totalRows: review.summary.totalRows,
      importedRows: review.summary.importedRows,
      duplicateRows: review.summary.duplicateRows,
      issueCount: review.summary.issueCount,
      approvedRows: approved.length,
      pendingRows: pending.length,
      rejectedRows: rejected.length,
      displayedRows: Math.min(review.transactions.length, limit),
      hiddenRows: Math.max(review.transactions.length - limit, 0),
    },
    issues: review.issues,
    duplicates: review.duplicates,
    transactions: review.transactions.slice(0, limit),
  };
}

function createReviewId(timestamp) {
  return `review-${timestamp.replace(/[^0-9]/g, '').slice(0, 14)}`;
}
