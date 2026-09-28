import { z } from "zod";
import { infrai } from "./infrai_client";
import type { PropertyEvent } from "./property_schemas";
import { buildRuleBasedPlan, createPropertyToolset, type ToolResult } from "./property_tools";

const toolCallSchema = z.object({
  tool: z.enum(["scheduleVendorVisit", "sendTenantUpdate", "queueDocumentReminder", "createInspectionTask"]),
  input: z.record(z.any())
});

const finalAnswerSchema = z.object({
  summary: z.string(),
  toolCalls: z.array(toolCallSchema)
});

function buildPrompt(event: PropertyEvent): string {
  return [
    "You plan property-management operations.",
    "Return JSON with keys summary and toolCalls.",
    "Allowed tools: scheduleVendorVisit, sendTenantUpdate, queueDocumentReminder, createInspectionTask.",
    "Use only the event data given.",
    `Event: ${JSON.stringify(event)}`
  ].join("\n");
}

function runPlannedTools(toolCalls: Array<z.infer<typeof toolCallSchema>>): ToolResult[] {
  const tools = createPropertyToolset();
  return toolCalls.map((call) => {
    if (call.tool === "scheduleVendorVisit") {
      return tools.scheduleVendorVisit(call.input as never);
    }
    if (call.tool === "sendTenantUpdate") {
      return tools.sendTenantUpdate(call.input as never);
    }
    if (call.tool === "queueDocumentReminder") {
      return tools.queueDocumentReminder(call.input as never);
    }
    return tools.createInspectionTask(call.input as never);
  });
}

export async function runPropertyAgentLoop(event: PropertyEvent, idempotencyKey: string): Promise<{
  decision: string;
  actions: ToolResult[];
  source: "assistant" | "rules";
}> {
  const fallbackPlan = buildRuleBasedPlan(event, idempotencyKey);

  const response = await infrai.chat.completions<{
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  }>({
    model: "auto",
    messages: [
      {
        role: "user",
        content: buildPrompt(event)
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    return {
      decision: "No assistant plan returned; used local rules.",
      actions: fallbackPlan,
      source: "rules"
    };
  }

  const parsed = finalAnswerSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    return {
      decision: "Assistant response did not match the contract; used local rules.",
      actions: fallbackPlan,
      source: "rules"
    };
  }

  const actions = runPlannedTools(parsed.data.toolCalls);
  return {
    decision: parsed.data.summary,
    actions,
    source: "assistant"
  };
}
