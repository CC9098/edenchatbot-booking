import assert from "node:assert/strict";
import test from "node:test";

import {
  insertEmojiAtCaret,
  STAFF_EMOJI_GROUPS,
} from "@/lib/staff-emoji";

test("emoji insertion preserves the caret after a multicode-unit emoji", () => {
  assert.deepEqual(insertEmojiAtCaret("你好！", "😊", 2, 2), {
    value: "你好😊！",
    caret: 4,
  });
});

test("emoji insertion replaces the selected range", () => {
  assert.deepEqual(insertEmojiAtCaret("早安，病人", "🙏", 0, 2), {
    value: "🙏，病人",
    caret: 2,
  });
});

test("missing or invalid selection positions append at the end", () => {
  assert.deepEqual(insertEmojiAtCaret("收到", "👍", null, undefined), {
    value: "收到👍",
    caret: 4,
  });
  assert.deepEqual(insertEmojiAtCaret("收到", "💚", Number.NaN, 999), {
    value: "收到💚",
    caret: 4,
  });
});

test("staff picker groups stay curated and free of duplicate emoji values", () => {
  const emojis = STAFF_EMOJI_GROUPS.flatMap((group) =>
    group.emojis.map((option) => option.emoji),
  );

  assert.ok(emojis.length >= 40);
  assert.equal(new Set(emojis).size, emojis.length);
});
