import assert from "node:assert/strict";
import test from "node:test";

import {
  CHATWOOT_EDEN_TOOLS_PATH,
  getChatwootEdenToolsLoginPath,
} from "@/lib/chatwoot-eden-tools-auth";

test("Chatwoot Eden tools login path keeps users returning to the dashboard app", () => {
  assert.equal(CHATWOOT_EDEN_TOOLS_PATH, "/chatwoot/eden-tools");
  assert.equal(
    getChatwootEdenToolsLoginPath(),
    "/login?next=%2Fchatwoot%2Feden-tools",
  );
});
