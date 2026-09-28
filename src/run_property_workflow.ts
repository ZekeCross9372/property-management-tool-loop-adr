import { processPropertyWorkflow } from "./property_ops_service";

const request = {
  idempotencyKey: "doc-followup-204",
  event: {
    kind: "tenant_document",
    tenantId: "tenant_204",
    tenantName: "Jules Rivera",
    documentType: "insurance",
    status: "missing",
    dueDate: "2026-09-20"
  }
} as const;

const result = await processPropertyWorkflow(request);
console.log(JSON.stringify(result, null, 2));
