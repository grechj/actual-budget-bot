export function summarizeActualImportResult(result, options = {}) {
  const summary = {
    errors: result.errors ?? [],
    addedCount: result.added?.length ?? 0,
    updatedCount: result.updated?.length ?? 0,
    updatedPreviewCount: result.updatedPreview?.length ?? 0,
  };

  if (options.includeIds) {
    summary.added = result.added ?? [];
    summary.updated = result.updated ?? [];
    summary.updatedPreview = result.updatedPreview ?? [];
  }

  return summary;
}

export async function withoutConsoleInfo(task) {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};

  try {
    return await task();
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.debug = originalDebug;
  }
}
