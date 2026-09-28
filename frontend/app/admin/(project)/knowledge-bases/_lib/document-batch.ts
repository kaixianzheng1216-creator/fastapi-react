import type { DirectoryEntry } from "./directory";

export type DocumentBatchAction = "original" | "markdown" | "retry";
type DocumentEntry = Extract<DirectoryEntry, { type: "document" }>;

export function canRunDocumentAction(
  entry: DirectoryEntry,
  action: DocumentBatchAction,
): entry is DocumentEntry {
  if (entry.type !== "document") return false;
  if (action === "original") return entry.uploaded;
  if (action === "markdown") return entry.status === "ready";
  return entry.uploaded && (entry.status === "failed" || entry.status === "timed_out");
}

export async function runDocumentBatch(
  entries: DirectoryEntry[],
  action: DocumentBatchAction,
  execute: (documentId: string) => Promise<unknown>,
) {
  const documents = entries.filter((entry) => canRunDocumentAction(entry, action));
  const failures: { filename: string; error: unknown }[] = [];
  let succeeded = 0;

  for (const document of documents) {
    try {
      await execute(document.id);

      succeeded += 1;
    } catch (error) {
      failures.push({ filename: document.filename, error });
    }
  }

  return { succeeded, failures, skipped: entries.length - documents.length };
}
