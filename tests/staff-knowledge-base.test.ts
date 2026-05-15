import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeImportedStaffKnowledgeDocuments,
  type StaffKnowledgeNoteRow,
} from "@/lib/staff-knowledge-base";
import type { StaffKnowledgeDocument } from "@/lib/staff-knowledge-base-types";

function baseImportedDocument(): StaffKnowledgeDocument {
  return {
    id: "notion-import/eden-series/sample",
    title: "原始匯入檔",
    category: "EDEN姑娘系列",
    status: "draft",
    sensitivity: "internal",
    source: "staff-knowledge-base",
    updatedAt: "2026-05-10",
    excerpt: "原文摘要",
    contentMd: "# 原始匯入檔\n\n原文",
    patientReplyMd: null,
    sourcePath: "docs/staff-knowledge-base/notion-import/eden-series/sample.md",
    tags: ["EDEN姑娘系列", "draft", "internal"],
    editable: true,
    imported: true,
  };
}

function importedRow(overrides: Partial<StaffKnowledgeNoteRow> = {}): StaffKnowledgeNoteRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    title: "已修改匯入檔",
    body_md: "# 已修改匯入檔\n\n## 病人可見回覆\n\n新版回覆",
    status: "ready",
    source: "manual",
    tags: ["staff-knowledge", "staff-category:EDEN姑娘系列", "staff-sensitivity:internal"],
    source_hash: "staff-knowledge-import:notion-import/eden-series/sample",
    is_active: true,
    created_by: "22222222-2222-2222-2222-222222222222",
    updated_by: "22222222-2222-2222-2222-222222222222",
    created_at: "2026-05-11T00:00:00.000Z",
    updated_at: "2026-05-11T01:00:00.000Z",
    ...overrides,
  };
}

test("mergeImportedStaffKnowledgeDocuments overlays edited imported files", () => {
  const merged = mergeImportedStaffKnowledgeDocuments(
    [baseImportedDocument()],
    [importedRow()],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "notion-import/eden-series/sample");
  assert.equal(merged[0].noteId, "11111111-1111-1111-1111-111111111111");
  assert.equal(merged[0].title, "已修改匯入檔");
  assert.equal(merged[0].contentMd.includes("新版回覆"), true);
  assert.equal(merged[0].patientReplyMd, "新版回覆");
  assert.equal(merged[0].sourcePath, "docs/staff-knowledge-base/notion-import/eden-series/sample.md");
});

test("mergeImportedStaffKnowledgeDocuments hides archived imported files", () => {
  const merged = mergeImportedStaffKnowledgeDocuments(
    [baseImportedDocument()],
    [importedRow({ status: "archived" })],
  );

  assert.deepEqual(merged, []);
});
