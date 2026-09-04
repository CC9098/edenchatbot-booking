import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import {
  GET as getDoctorForwardOptions,
  POST as postDoctorForward,
} from "@/app/api/nurse/chatwoot-contacts/[contactId]/conversations/[conversationId]/doctor-forward/route";
import { createChatwootEdenToolsSessionToken } from "@/lib/chatwoot-eden-tools-session";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("doctor forward route validates, writes, and reads back the Chatwoot handoff", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_DOCTOR_AGENT_IDS: process.env.CHATWOOT_DOCTOR_AGENT_IDS,
    CHATWOOT_EDEN_TOOLS_SESSION_SECRET: process.env.CHATWOOT_EDEN_TOOLS_SESSION_SECRET,
  };
  const postedBodies: Array<{ path: string; body: Record<string, unknown> }> = [];

  process.env.CHATWOOT_BASE_URL = "https://chatwoot.example";
  process.env.CHATWOOT_API_ACCESS_TOKEN = "api-token";
  process.env.CHATWOOT_ACCOUNT_ID = "2";
  process.env.CHATWOOT_DOCTOR_AGENT_IDS = "8";
  process.env.CHATWOOT_EDEN_TOOLS_SESSION_SECRET = "route-test-secret";

  const forwardAttributes = {
    eden_tools: {
      action: "eden_tools_doctor_forward",
      source_message_id: 101,
      doctor_agent_id: 8,
      forwarded_by_user_id: "staff-user",
      forwarded_by_role: "assistant",
    },
  };

  const savedConversation: any = { id: 42, inbox_id: 7, meta: { sender: { id: 99 } }, custom_attributes: {} };
  let noteCreated = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const parsedUrl = new URL(requestUrl);
    const path = `${parsedUrl.pathname}${parsedUrl.search}`;
    const method = init?.method || "GET";

    if (method === "GET" && path === "/api/v1/accounts/2/conversations/42") {
      return jsonResponse(savedConversation);
    }
    if (method === "GET" && path === "/api/v1/accounts/2/agents") {
      return jsonResponse([{
        id: 8,
        name: "Dr Leung",
        role: "administrator",
        confirmed: true,
        availability_status: "offline",
      }]);
    }
    if (method === "GET" && path === "/api/v1/accounts/2/inbox_members/7") {
      return jsonResponse({ payload: [] });
    }
    if (method === "GET" && path === "/api/v1/accounts/2/conversations/42/messages?before=102") {
      return jsonResponse({
        payload: [{ id: 101, message_type: "incoming", private: false, content: "病人資料" }],
      });
    }
    if (method === "GET" && path === "/api/v1/accounts/2/conversations/42/messages") {
      return jsonResponse({ payload: noteCreated ? [{ id: 202, private: true, content_attributes: forwardAttributes }] : [] });
    }
    if (method === "POST" && path === "/api/v1/accounts/2/conversations/42/participants") {
      const body = JSON.parse(String(init?.body || "{}"));
      postedBodies.push({ path, body });
      return jsonResponse([{ id: 8, name: "Dr Leung" }]);
    }
    if (method === "POST" && path === "/api/v1/accounts/2/conversations/42/messages") {
      const body = JSON.parse(String(init?.body || "{}"));
      postedBodies.push({ path, body });
      noteCreated = true;
      return jsonResponse({ id: 202, private: true, content_attributes: body.content_attributes });
    }
    if (method === "GET" && path === "/api/v1/accounts/2/conversations/42/participants") {
      return jsonResponse([{ id: 8, name: "Dr Leung" }]);
    }
    if (method === "GET" && path === "/api/v1/accounts/2/conversations/42/messages?before=203") {
      return jsonResponse({
        payload: [{ id: 202, private: true, content_attributes: forwardAttributes }],
      });
    }

    if (method === "POST" && ["/assignments", "/custom_attributes", "/toggle_status"].some(suffix => path.endsWith(suffix))) {
      const body = JSON.parse(String(init?.body || "{}"));
      postedBodies.push({ path, body });
      if (path.endsWith("/custom_attributes")) Object.assign(savedConversation.custom_attributes, body.custom_attributes);
      if (path.endsWith("/assignments")) savedConversation.meta.assignee = { id: body.assignee_id };
      if (path.endsWith("/toggle_status")) savedConversation.status = body.status;
      return jsonResponse({});
    }
    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof globalThis.fetch;

  try {
    const token = createChatwootEdenToolsSessionToken({
      userId: "staff-user",
      role: "assistant",
      staffKind: "core_assistant",
    });
    const headers = { Authorization: `Bearer ${token}` };
    const context = { params: { contactId: "99", conversationId: "42" } };

    const optionsResponse = await getDoctorForwardOptions(
      new NextRequest("http://localhost/api/doctor-forward", { headers }),
      context,
    );
    assert.equal(optionsResponse.status, 200);
    assert.deepEqual((await optionsResponse.json()).doctors, [{
      id: 8,
      name: "Dr Leung",
      availabilityStatus: "offline",
    }]);

    const response = await postDoctorForward(
      new NextRequest("http://localhost/api/doctor-forward", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: 101, doctorAgentId: 8 }),
      }),
      context,
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.verified, true);
    assert.equal(payload.duplicate, false);
    assert.deepEqual(postedBodies[0], {
      path: "/api/v1/accounts/2/conversations/42/participants",
      body: { user_ids: [8] },
    });
    assert.equal(postedBodies[1]?.path, "/api/v1/accounts/2/conversations/42/messages");
    assert.equal(postedBodies[1]?.body.private, true);
    assert.deepEqual(postedBodies[1]?.body.content_attributes, forwardAttributes);
    assert.match(String(postedBodies[1]?.body.content || ""), /mention:\/\/user\/8\/Dr%20Leung/);
    assert.match(String(postedBodies[1]?.body.content || ""), /messageId=101/);
    assert.match(String(postedBodies[1]?.body.content || ""), /conversations\?id=42/);
    assert.equal(postedBodies.find(item => item.path.endsWith("/assignments"))?.body.assignee_id, 8);
    assert.equal((postedBodies.find(item => item.path.endsWith("/custom_attributes"))?.body.custom_attributes as any).eden_workspace.stage, "doctor");
    assert.equal(postedBodies.find(item => item.path.endsWith("/toggle_status"))?.body.status, "open");
    savedConversation.status = "resolved";
    savedConversation.custom_attributes.eden_workspace.stage = "done";
    const beforeRetry = postedBodies.length;
    const retry = await postDoctorForward(new NextRequest("http://localhost/api/doctor-forward", {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: 101, doctorAgentId: 8 }),
    }), context);
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    assert.equal(savedConversation.status, "resolved");
    assert.equal(postedBodies.slice(beforeRetry).some(item => item.path.endsWith("/assignments") || item.path.endsWith("/custom_attributes") || item.path.endsWith("/toggle_status") || item.path.endsWith("/messages")), false);

  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (typeof value === "undefined") delete process.env[key];
      else process.env[key] = value;
    }
  }
});
