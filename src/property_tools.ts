import type { InspectionReminder, MaintenanceRequest, TenantDocument } from "./property_schemas";

export type ToolResult = {
  toolName: string;
  output: Record<string, unknown>;
};

export type PropertyToolset = {
  scheduleVendorVisit(input: {
    requestId: string;
    unitLabel: string;
    priority: "emergency" | "routine";
    trade: "plumber" | "electrician" | "general";
    summary: string;
    idempotencyKey: string;
  }): ToolResult;
  sendTenantUpdate(input: {
    tenantName: string;
    channel: "email" | "sms";
    subject: string;
    body: string;
    idempotencyKey: string;
  }): ToolResult;
  queueDocumentReminder(input: {
    tenantId: string;
    documentType: TenantDocument["documentType"];
    dueDate: string;
    tone: "friendly" | "urgent";
    idempotencyKey: string;
  }): ToolResult;
  createInspectionTask(input: {
    propertyId: string;
    inspectionType: InspectionReminder["inspectionType"];
    dueDate: string;
    assignee: string;
    idempotencyKey: string;
  }): ToolResult;
};

export function createPropertyToolset(): PropertyToolset {
  return {
    scheduleVendorVisit(input) {
      return {
        toolName: "scheduleVendorVisit",
        output: {
          status: "scheduled",
          confirmationId: `visit_${input.requestId}`,
          ...input
        }
      };
    },
    sendTenantUpdate(input) {
      return {
        toolName: "sendTenantUpdate",
        output: {
          status: "queued",
          messageId: `msg_${input.idempotencyKey}`,
          ...input
        }
      };
    },
    queueDocumentReminder(input) {
      return {
        toolName: "queueDocumentReminder",
        output: {
          status: "queued",
          reminderId: `doc_${input.tenantId}_${input.documentType}`,
          ...input
        }
      };
    },
    createInspectionTask(input) {
      return {
        toolName: "createInspectionTask",
        output: {
          status: "created",
          taskId: `inspection_${input.propertyId}_${input.inspectionType}`,
          ...input
        }
      };
    }
  };
}

export function buildRuleBasedPlan(event: MaintenanceRequest | TenantDocument | InspectionReminder, idempotencyKey: string): ToolResult[] {
  if (event.kind === "maintenance_request") {
    const emergency = event.emergencySigns.some((flag) => ["water leak", "sparks", "no heat"].includes(flag.toLowerCase()));
    const trade: "plumber" | "electrician" | "general" = event.issueSummary.toLowerCase().includes("leak")
      ? "plumber"
      : event.issueSummary.toLowerCase().includes("outlet") || event.issueSummary.toLowerCase().includes("spark")
        ? "electrician"
        : "general";

    const tools = createPropertyToolset();
    return [
      tools.scheduleVendorVisit({
        requestId: event.requestId,
        unitLabel: event.unitLabel,
        priority: emergency ? "emergency" : "routine",
        trade,
        summary: event.issueSummary,
        idempotencyKey
      }),
      tools.sendTenantUpdate({
        tenantName: event.tenantName,
        channel: "sms",
        subject: emergency ? "Emergency maintenance dispatched" : "Maintenance request received",
        body: emergency
          ? `A ${trade} visit has been dispatched for ${event.unitLabel}.`
          : `We logged your request for ${event.unitLabel} and will share the appointment window shortly.`,
        idempotencyKey
      })
    ];
  }

  if (event.kind === "tenant_document") {
    if (event.status === "received") {
      return [];
    }

    const tools = createPropertyToolset();
    return [
      tools.queueDocumentReminder({
        tenantId: event.tenantId,
        documentType: event.documentType,
        dueDate: event.dueDate,
        tone: event.status === "missing" ? "urgent" : "friendly",
        idempotencyKey
      })
    ];
  }

  if (event.daysUntilDue > 7) {
    return [];
  }

  const tools = createPropertyToolset();
  return [
    tools.createInspectionTask({
      propertyId: event.propertyId,
      inspectionType: event.inspectionType,
      dueDate: event.dueDate,
      assignee: "field_ops",
      idempotencyKey
    })
  ];
}
