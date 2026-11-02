import { Router } from "express";
import { LeadStatus } from "@prisma/client";
import { z } from "zod";
import { inngest } from "../lib/inngest";
import { prisma } from "../lib/prisma";

export const leadsRouter = Router();

const createLeadSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
});

const updateLeadSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(1).optional(),
    status: z.nativeEnum(LeadStatus).optional(),
    salespersonId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

const convertLeadSchema = z.object({
  amount: z.number().finite().min(0).default(0),
  address: z.string().trim().optional(),
  issuerId: z.string().optional(),
});

leadsRouter.get("/", async (req, res, next) => {
  try {
    const salespersonId = typeof req.query.salespersonId === "string" ? req.query.salespersonId : undefined;

    const leads = await prisma.lead.findMany({
      ...(salespersonId ? { where: { salespersonId } } : {}),
      include: { salesperson: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(leads);
  } catch (error) {
    next(error);
  }
});

leadsRouter.get("/:id", async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        salesperson: true,
        tasks: { orderBy: { createdAt: "desc" } },
        activityLogs: { orderBy: { timestamp: "desc" } },
        contact: true,
        deal: true,
      },
    });

    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    res.json(lead);
  } catch (error) {
    next(error);
  }
});

leadsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid lead", details: parsed.error.issues });
      return;
    }

    const lead = await prisma.lead.create({ data: parsed.data });

    try {
      await inngest.send({ name: "lead/created", data: { leadId: lead.id } });
    } catch (error) {
      await prisma.lead.delete({ where: { id: lead.id } });
      throw error;
    }

    res.status(201).json(lead);
  } catch (error) {
    next(error);
  }
});

leadsRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid lead update", details: parsed.error.issues });
      return;
    }

    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    if (existing.status === LeadStatus.CONVERTED) {
      res.status(409).json({ error: "Converted leads are read-only" });
      return;
    }

    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.salespersonId !== undefined ? { salespersonId: parsed.data.salespersonId } : {}),
      },
    });

    await inngest.send({
      name: "lead/updated",
      data: {
        leadId: lead.id,
        issuerId: typeof req.body.issuerId === "string" ? req.body.issuerId : undefined,
        changes: parsed.data,
      },
    });

    res.json(lead);
  } catch (error) {
    next(error);
  }
});

leadsRouter.post("/:id/activity", async (req, res, next) => {
  try {
    const body = z
      .object({
        description: z.string().trim().min(1),
        issuerId: z.string().optional(),
      })
      .safeParse(req.body);

    if (!body.success) {
      res.status(400).json({ error: "Invalid activity", details: body.error.issues });
      return;
    }

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    const activity = await prisma.activityLog.create({
      data: {
        entityType: "LEAD",
        entityId: lead.id,
        action: "UPDATED",
        description: body.data.description,
        ...(body.data.issuerId !== undefined ? { issuerId: body.data.issuerId } : {}),
        leadId: lead.id,
      },
    });

    res.status(201).json(activity);
  } catch (error) {
    next(error);
  }
});

leadsRouter.post("/:id/convert", async (req, res, next) => {
  try {
    const parsed = convertLeadSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid conversion data",
        details: parsed.error.issues,
      });
      return;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
    });

    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    if (lead.status === LeadStatus.CONVERTED) {
      res.status(409).json({ error: "Lead has already been converted" });
      return;
    }

    if (!lead.salespersonId) {
      res.status(409).json({
        error: "Lead must be assigned to a salesperson before conversion",
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          ...(parsed.data.address !== undefined ? { address: parsed.data.address } : {}),
          leadId: lead.id,
        },
      });

      const deal = await tx.deal.create({
        data: {
          amount: parsed.data.amount,
          salespersonId: lead.salespersonId!,
          leadId: lead.id,
        },
      });

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: { status: LeadStatus.CONVERTED },
      });

      const activity = await tx.activityLog.create({
        data: {
          entityType: "LEAD",
          entityId: lead.id,
          action: "CONVERTED",
          description: `Lead converted to contact and deal (${parsed.data.amount})`,
          leadId: lead.id,
          issuerId: parsed.data.issuerId ?? "system",
        },
      });

      return { lead: updatedLead, contact, deal, activity };
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});
