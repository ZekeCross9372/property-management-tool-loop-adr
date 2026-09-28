import test from "node:test";
import assert from "node:assert/strict";
import { processPropertyWorkflow } from "../src/property_ops_service";
import { postInfrai } from "../src/infrai_client";

test("accepts a standard chat completion response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: "chatcmpl-test",
    choices: [{ message: { content: '{"summary":"Done","toolCalls":[]}' } }]
  }), { status: 200 });

  try {
    const response = await postInfrai<{ choices: Array<{ message: { content: string } }> }>(
      "/v1/chat/completions",
      { model: "auto", messages: [] }
    );
    assert.equal(response.data?.choices[0].message.content, '{"summary":"Done","toolCalls":[]}');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("emergency leak schedules a plumber visit and tenant update", async () => {
  const result = await processPropertyWorkflow({
    idempotencyKey: "test-emergency-1",
    event: {
      kind: "maintenance_request",
      requestId: "req_test_1",
      tenantName: "Maya Chen",
      unitLabel: "A-12",
      issueSummary: "There is a leak under the sink and water is pooling on the floor.",
      emergencySigns: ["water leak"],
      enteredAt: "2026-09-10T09:00:00Z"
    }
  });

  assert.equal(result.accepted, true);
  assert.equal(result.actions.length, 2);
  assert.equal(result.actions[0].toolName, "scheduleVendorVisit");
  assert.equal(result.actions[0].output.priority, "emergency");
  assert.equal(result.actions[0].output.trade, "plumber");
  assert.equal(result.actions[1].toolName, "sendTenantUpdate");
});
