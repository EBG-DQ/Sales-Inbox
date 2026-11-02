import { eventType, Inngest, staticSchema } from "inngest";

const leadCreated = eventType("lead/created", {
  schema: staticSchema<{ leadId: string }>(),
});

const leadUpdated = eventType("lead/updated", {
  schema: staticSchema<{
    leadId: string;
    issuerId?: string;
    changes: Record<string, unknown>;
  }>(),
});

export const inngest = new Inngest({
  id: "sales-lead-management",
  // Local development uses the Inngest Dev Server and does not require a cloud event key.
  // Production defaults to cloud mode, where INNGEST_EVENT_KEY is required.
  isDev: process.env.NODE_ENV !== "production",
  schemas: {
    "lead/created": leadCreated,
    "lead/updated": leadUpdated,
  },
});
