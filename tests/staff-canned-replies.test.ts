import test from "node:test";
import assert from "node:assert/strict";
import {
  filterStaffCannedReplies,
  getCannedReplySlashToken,
  normalizeStaffCannedReplies,
  replaceCannedReplySlashToken,
} from "@/lib/staff-canned-replies";

test("normalizes Chatwoot canned responses and drops malformed duplicates", () => {
  const replies = normalizeStaffCannedReplies([
    { id: 4, short_code: "  chan ", content: "診所地址" },
    { id: "4", short_code: "duplicate", content: "不要顯示" },
    { id: 5, shortCode: "fee", content: "收費資料" },
    { id: 0, short_code: "bad", content: "不要顯示" },
    { id: 6, short_code: "empty", content: "  " },
  ]);

  assert.deepEqual(replies, [
    { id: 4, shortCode: "chan", content: "診所地址" },
    { id: 5, shortCode: "fee", content: "收費資料" },
  ]);
});

test("filters canned replies by short code or preview content", () => {
  const replies = [
    { id: 1, shortCode: "chan", content: "中環地址" },
    { id: 2, shortCode: "fee", content: "收費資料" },
  ];
  assert.deepEqual(filterStaffCannedReplies(replies, "/CHAN"), [replies[0]]);
  assert.deepEqual(filterStaffCannedReplies(replies, "地址"), [replies[0]]);
  assert.deepEqual(filterStaffCannedReplies(replies, ""), replies);
});

test("matches slash commands only at a token boundary", () => {
  assert.deepEqual(getCannedReplySlashToken("請問 /chan"), {
    start: 3,
    end: 8,
    query: "chan",
  });
  assert.deepEqual(getCannedReplySlashToken("/"), {
    start: 0,
    end: 1,
    query: "",
  });
  assert.equal(getCannedReplySlashToken("https://example.test/chan"), null);
});

test("replaces only the slash token and returns the new cursor position", () => {
  assert.deepEqual(
    replaceCannedReplySlashToken("你好 /chan，", 8, "中環地址"),
    { value: "你好 中環地址，", cursor: 7 },
  );
  assert.deepEqual(
    replaceCannedReplySlashToken("/fee", 4, "收費資料"),
    { value: "收費資料", cursor: 4 },
  );
});
