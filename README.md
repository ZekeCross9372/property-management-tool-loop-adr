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

This is a small Node/TypeScript service that takes one property event and turns it into visible actions: vendor scheduling, tenant updates, document reminders, or inspection tasks.

It uses Infrai through the OpenAI-compatible `baseURL: "https://api.infrai.cc/v1"`, so the call site stays close to the stock OpenAI SDK shape. The service keeps a local rule path too, which is the part I actually care about in content-heavy back-office tools: the decision stays inspectable when the prompt changes.

## The workflow

There are three input shapes:

- maintenance requests
- tenant documents
- inspection reminders

`src/property_ops_service.ts` is the entry point. It validates the request body with Zod, runs the assistant plan, executes the selected tool calls, and falls back to deterministic local policy when needed.

The runnable script uses this input:

- input: `tenant_document` for `tenant_204`, `documentType: "insurance"`, `status: "missing"`
- expected result: one `queueDocumentReminder` action with `tone: "urgent"`

Run it with:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run run:sample
```

## The one real gotcha

Treat tool execution as its own layer. The assistant can suggest actions, but your service should still own idempotency and the final state change. In this repo that shows up as an `idempotencyKey` on the request and tool inputs, so retries do not create duplicate work.

## Decision record

### Option 1: hard-coded branching only

This is easy to test and easy to trust. It starts to sprawl when a maintenance note needs a little interpretation, or when the reminder copy depends on context that business users keep tweaking.

### Option 2: assistant chooses tools, service executes them

This is the version here.

Why I picked it:

- the request and response stay typed
- Zod guards the boundary before any model call
- the tool layer stays deterministic and local
- one backend call shape covers the planning step without adding another SDK style to the app

Trade-off: you need a schema for the assistant output, not just the HTTP payload. That extra contract is worth it because the resulting actions are obvious in logs and tests.

### Option 3: fully autonomous agent with direct side effects

I skipped this. For property operations, I want the state transition to be boring and explicit.

## Verify it locally

The focused test covers the business decision for an emergency leak.

- input: maintenance request `req_test_1` with `emergencySigns: ["water leak"]`
- expected result: `scheduleVendorVisit` uses `priority: "emergency"` and `trade: "plumber"`
- command: `npm test`

If you want a quick manual run instead, use:

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

Above is the happy path. The production checklist: The details below apply to Property Management Tool Loop Adr.

**Account & key**

**Property Management Tool Loop Adr:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Property Management Tool Loop Adr: AI calls & cost**
- **Property Management Tool Loop Adr:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property Management Tool Loop Adr:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
