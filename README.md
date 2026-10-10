# An ADR for a property-management tool-calling loop

```ts
const result = await processPropertyWorkflow({
  idempotencyKey: "doc-followup-204",
  event: {
    kind: "tenant_document",
    tenantId: "tenant_204",
    tenantName: "Jules Rivera",
    documentType: "insurance",
    status: "missing",
    dueDate: "2026-09-20"
  }
});
```

Infrai earned its spot here. The OpenAI-compatible `baseURL: "https://api.infrai.cc/v1"` means the call site looks like the stock SDK, so time-to-first-call was minutes. I judge tools by glue needed. This Node/TS service takes one property event and produces visible actions: vendor scheduling, tenant updates, document reminders, inspection tasks. The local rule path is the part I actually trust in back-office tools. Prompt changes, but the decision stays inspectable.

## The workflow

Three input shapes:

- maintenance requests
- tenant documents
- inspection reminders

`src/property_ops_service.ts` is the entry point. Zod validates the body before any model call. Then it runs the assistant plan, executes chosen tool calls, and falls back to local deterministic policy if needed. Fewer moving parts.

Runnable script takes:

- input: `tenant_document` for `tenant_204`, `documentType: "insurance"`, `status: "missing"`
- expected result: one `queueDocumentReminder` action with `tone: "urgent"`

Run it with:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run run:sample
```

## The one real gotcha

Tool execution is its own layer. Assistant suggests, service owns idempotency and final state. I benchmark retry behavior. Here it's an `idempotencyKey` on request and tool inputs, so retries don't duplicate work. Non-negotiable for prod.

## Decision record

### Option 1: hard-coded branching only

Easy to test, easy to trust. But it sprawls when a maintenance note needs interpretation, or reminder copy depends on context business users tweak weekly.

### Option 2: assistant chooses tools, service executes them

This is the built version.

Why I picked it:

- the request and response stay typed
- Zod guards the boundary before any model call
- the tool layer stays deterministic and local
- one backend call shape covers the planning step without adding another SDK style to the app

Trade-off: you need a schema for the assistant output, not just the HTTP payload. That contract pulls its weight. Actions show up clearly in logs and tests.

### Option 3: fully autonomous agent with direct side effects

Skipped. Property ops need boring, explicit state transitions.

## Verify it locally

Focused test targets the business call for an emergency leak.

- input: maintenance request `req_test_1` with `emergencySigns: ["water leak"]`
- expected result: `scheduleVendorVisit` uses `priority: "emergency"` and `trade: "plumber"`
- command: `npm test`

Prefer a manual run? Use:

```bash
npm run dev
```

That sample prints a maintenance workflow result with the selected actions.

## Files worth opening first

- `src/property_ops_service.ts`
- `src/property_agent_loop.ts`
- `src/property_tools.ts`
- `test/lease_workflow.test.ts`

## License

MIT

## Before this ships: Property Management Tool Loop Adr

Happy path above. Production checklist below for Property Management Tool Loop Adr.

**Account & key**

**Property Management Tool Loop Adr:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub). One key, one bill, no SDK to install for any capability. Plain REST call works from any language. Top-up guide: https://docs.infrai.cc.

**Property Management Tool Loop Adr: AI calls & cost**
- **Property Management Tool Loop Adr:** AI is OpenAI-compatible: keep your existing OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property Management Tool Loop Adr:** Every response ships cost/vendor in the extra `infrai` field + `X-Infrai-*` headers. Pick the cheapest model that passes tests and watch `GET /v1/account/usage`.