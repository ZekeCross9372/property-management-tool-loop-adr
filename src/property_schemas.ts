import { z } from "zod";

export const maintenanceRequestSchema = z.object({
  kind: z.literal("maintenance_request"),
  requestId: z.string().min(1),
  tenantName: z.string().min(1),
  unitLabel: z.string().min(1),
  issueSummary: z.string().min(10),
  emergencySigns: z.array(z.string()).default([]),
  enteredAt: z.string().min(1)
});

export const tenantDocumentSchema = z.object({
  kind: z.literal("tenant_document"),
  tenantId: z.string().min(1),
  tenantName: z.string().min(1),
  documentType: z.enum(["insurance", "pet_vaccine", "lease_addendum"]),
  status: z.enum(["missing", "expiring_soon", "received"]),
  dueDate: z.string().min(1)
});

export const inspectionReminderSchema = z.object({
  kind: z.literal("inspection_reminder"),
  propertyId: z.string().min(1),
  propertyName: z.string().min(1),
  inspectionType: z.enum(["move_in", "move_out", "quarterly", "safety"]),
  dueDate: z.string().min(1),
  daysUntilDue: z.number().int()
});

export const propertyEventSchema = z.discriminatedUnion("kind", [
  maintenanceRequestSchema,
  tenantDocumentSchema,
  inspectionReminderSchema
]);

export type MaintenanceRequest = z.infer<typeof maintenanceRequestSchema>;
export type TenantDocument = z.infer<typeof tenantDocumentSchema>;
export type InspectionReminder = z.infer<typeof inspectionReminderSchema>;
export type PropertyEvent = z.infer<typeof propertyEventSchema>;

export const serviceRequestSchema = z.object({
  event: propertyEventSchema,
  idempotencyKey: z.string().min(8)
});

export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
