import { serviceRequestSchema, type ServiceRequest } from "./property_schemas";
import { buildRuleBasedPlan } from "./property_tools";
import { runPropertyAgentLoop } from "./property_agent_loop";

export type PropertyWorkflowResult = {
  accepted: true;
  source: "assistant" | "rules";
  decision: string;
  actions: Array<{
    toolName: string;
    output: Record<string, unknown>;
  }>;
};

export async function processPropertyWorkflow(input: unknown): Promise<PropertyWorkflowResult> {
  const request: ServiceRequest = serviceRequestSchema.parse(input);

  try {
    const result = await runPropertyAgentLoop(request.event, request.idempotencyKey);
    return {
      accepted: true,
      source: result.source,
      decision: result.decision,
      actions: result.actions
    };
  } catch {
    const actions = buildRuleBasedPlan(request.event, request.idempotencyKey);
    return {
      accepted: true,
      source: "rules",
      decision: "Used the local policy for this property event.",
      actions
    };
  }
}

const sampleRequest: ServiceRequest = {
  idempotencyKey: "maint-req-1001",
  event: {
    kind: "maintenance_request",
    requestId: "req_1001",
    tenantName: "Maya Chen",
    unitLabel: "A-12",
    issueSummary: "Kitchen sink leak under the cabinet with standing water.",
    emergencySigns: ["water leak"],
    enteredAt: "2026-09-10T09:00:00Z"
  }
};

async function main(): Promise<void> {
  const result = await processPropertyWorkflow(sampleRequest);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
