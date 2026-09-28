import assert from "node:assert/strict";
import test from "node:test";
import {
  canRunDocumentAction,
  runDocumentBatch,
} from "../app/admin/(project)/knowledge-bases/_lib/document-batch.ts";

const document = (id, status, uploaded = true) => ({
  type: "document", id, filename: `${id}.pdf`, status, uploaded,
});
const entries = [
  { type: "folder", id: "folder" },
  document("ready", "ready"),
  document("failed", "failed"),
  document("timeout", "timed_out"),
  document("processing", "processing"),
  document("pending", "pending", false),
  document("not-uploaded", "failed", false),
  document("web", "ready", false),
];

test("mixed selections only include documents eligible for each action", () => {
  const ids = (action) => entries.filter((entry) => canRunDocumentAction(entry, action)).map(({ id }) => id);
  assert.deepEqual(ids("original"), ["ready", "failed", "timeout", "processing"]);
  assert.deepEqual(ids("markdown"), ["ready", "web"]);
  assert.deepEqual(ids("retry"), ["failed", "timeout"]);
});

test("a failed request does not stop later documents; requests run sequentially", async () => {
  const calls = [];
  const error = { detail: "文档状态已变化" };
  let active = 0;
  const result = await runDocumentBatch(entries, "retry", async (id) => {
    active += 1;
    assert.equal(active, 1);
    calls.push(id);
    await Promise.resolve();
    active -= 1;
    if (id === "failed") throw error;
  });
  assert.deepEqual(calls, ["failed", "timeout"]);
  assert.deepEqual(result, {
    succeeded: 1,
    failures: [{ filename: "failed.pdf", error }],
    skipped: 6,
  });
});

test("ineligible and empty selections send no requests", async () => {
  for (const selection of [[], [entries[0], entries[1], entries[4]]]) {
    const result = await runDocumentBatch(selection, "retry", async () => {
      assert.fail("unexpected request");
    });
    assert.deepEqual(result, { succeeded: 0, failures: [], skipped: selection.length });
  }
});

test("all failed requests are reported individually", async () => {
  const error = new Error("Network error");
  const result = await runDocumentBatch(entries, "markdown", async () => {
    throw error;
  });
  assert.equal(result.succeeded, 0);
  assert.deepEqual(result.failures.map(({ filename }) => filename), ["ready.pdf", "web.pdf"]);
  assert.equal(result.skipped, 6);
});
