import { inngest } from "../lib/inngest";
import { prisma } from "../lib/prisma";

export type SalespersonOption = {
  id: string;
  name: string;
};

export function chooseRandomSalesperson(
  salespeople: SalespersonOption[],
  random: () => number = Math.random,
): SalespersonOption {
  if (salespeople.length === 0) {
    throw new Error("Cannot assign lead: no salespeople exist");
  }

  const index = Math.floor(random() * salespeople.length);
  return salespeople[index]!;
}

export const assignLeadAndCreateTask = inngest.createFunction(
  {
    id: "assign-lead-and-create-initial-task",
    triggers: [{ event: "lead/created" }],
  },
  async ({ event, step }) => {
    const { leadId } = event.data;

    const lead = await step.run("fetch-lead", () =>
      prisma.lead.findUnique({
        where: { id: leadId },
        include: { salesperson: true },
      }),
    );

    if (!lead) {
      return { skipped: true, reason: "Lead not found" };
    }

    const salesperson =
      lead.salesperson ??
      (await step.run("choose-salesperson", async () => {
        const salespeople = await prisma.salesperson.findMany({
          select: { id: true, name: true },
        });

        return chooseRandomSalesperson(salespeople);
      }));

    await step.run("assign-lead", () =>
      prisma.lead.update({
        where: { id: lead.id },
        data: { salespersonId: salesperson.id },
      }),
    );

    await step.run("create-initial-call-task", () =>
      prisma.task.upsert({
        where: { id: `initial-call-${lead.id}` },
        update: {},
        create: {
          id: `initial-call-${lead.id}`,
          type: "CALL",
          description: "Initial follow-up call",
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          leadId: lead.id,
          salespersonId: salesperson.id,
        },
      }),
    );

    await step.run("log-lead-created", () =>
      prisma.activityLog.upsert({
        where: { id: `lead-created-${lead.id}` },
        update: {},
        create: {
          id: `lead-created-${lead.id}`,
          entityType: "LEAD",
          entityId: lead.id,
          action: "CREATED",
          description: "Lead created",
          leadId: lead.id,
          issuerId: "system",
        },
      }),
    );

    await step.run("log-lead-assigned", () =>
      prisma.activityLog.upsert({
        where: { id: `lead-assigned-${lead.id}` },
        update: {},
        create: {
          id: `lead-assigned-${lead.id}`,
          entityType: "LEAD",
          entityId: lead.id,
          action: "UPDATED",
          description: `Lead assigned to ${salesperson.name}`,
          leadId: lead.id,
          issuerId: "system",
        },
      }),
    );

    return {
      leadId: lead.id,
      salespersonId: salesperson.id,
    };
  },
);

export const logLeadUpdate = inngest.createFunction(
  {
    id: "log-lead-updates",
    triggers: [{ event: "lead/updated" }],
  },
  async ({ event, step }) => {
    const { leadId, issuerId, changes } = event.data;

    const lead = await step.run("check-lead-exists", () =>
      prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true },
      }),
    );

    if (!lead) {
      return { skipped: true, reason: "Lead not found" };
    }

    await step.run("write-update-activity-log", () =>
      prisma.activityLog.create({
        data: {
          entityType: "LEAD",
          entityId: leadId,
          action: "UPDATED",
          description: `Lead updated: ${JSON.stringify(changes)}`,
          leadId,
          issuerId: issuerId ?? "system",
        },
      }),
    );

    return { leadId, logged: true };
  },
);
