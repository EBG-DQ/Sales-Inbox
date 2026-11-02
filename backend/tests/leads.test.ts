import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, inngestMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    contact: {
      create: vi.fn(),
    },
    deal: {
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  inngestMock: {
    send: vi.fn(),
  },
}));

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/inngest", () => ({ inngest: inngestMock }));

import { leadsRouter } from "../src/routes/leads";

const app = express();
app.use(express.json());
app.use("/leads", leadsRouter);

describe("lead API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists leads", async () => {
    prismaMock.lead.findMany.mockResolvedValue([
      {
        id: "lead-1",
        name: "Morgan Chen",
        email: "morgan@example.com",
        phone: "555-0102",
        status: "NEW",
        salesperson: { name: "Alex Morgan" },
      },
    ]);

    const response = await request(app).get("/leads");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe("Morgan Chen");
  });

  it("rejects an invalid lead", async () => {
    const response = await request(app).post("/leads").send({ name: "", email: "bad-email", phone: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid lead");
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("creates a lead and sends the Inngest event", async () => {
    prismaMock.lead.create.mockResolvedValue({
      id: "lead-2",
      name: "Taylor Kim",
      email: "taylor@example.com",
      phone: "555-0103",
      status: "NEW",
    });
    inngestMock.send.mockResolvedValue({ ids: ["event-1"] });

    const response = await request(app).post("/leads").send({
      name: "Taylor Kim",
      email: "taylor@example.com",
      phone: "555-0103",
    });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe("lead-2");
    expect(inngestMock.send).toHaveBeenCalledWith({
      name: "lead/created",
      data: { leadId: "lead-2" },
    });
  });

  it("converts an assigned lead in a transaction", async () => {
    prismaMock.lead.findUnique.mockResolvedValue({
      id: "lead-3",
      name: "Jordan Lee",
      email: "jordan@example.com",
      phone: "555-0104",
      status: "WORKING",
      salespersonId: "salesperson-1",
    });

    prismaMock.contact.create.mockResolvedValue({
      id: "contact-1",
      leadId: "lead-3",
    });
    prismaMock.deal.create.mockResolvedValue({
      id: "deal-1",
      leadId: "lead-3",
      amount: 12500,
      salespersonId: "salesperson-1",
    });
    prismaMock.lead.update.mockResolvedValue({
      id: "lead-3",
      status: "CONVERTED",
    });
    prismaMock.activityLog.create.mockResolvedValue({
      id: "activity-1",
      action: "CONVERTED",
    });

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
      callback(prismaMock),
    );

    const response = await request(app).post("/leads/lead-3/convert").send({
      amount: 12500,
      address: "42 Test Street",
      issuerId: "system",
    });

    expect(response.status).toBe(201);
    expect(response.body.lead.status).toBe("CONVERTED");
    expect(response.body.deal.amount).toBe(12500);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.contact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Jordan Lee",
        leadId: "lead-3",
        address: "42 Test Street",
      }),
    });
    expect(prismaMock.deal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 12500,
        salespersonId: "salesperson-1",
        leadId: "lead-3",
      }),
    });
  });

  it("rejects conversion when the lead is already converted", async () => {
    prismaMock.lead.findUnique.mockResolvedValue({
      id: "lead-4",
      status: "CONVERTED",
      salespersonId: "salesperson-1",
    });

    const response = await request(app).post("/leads/lead-4/convert").send({ amount: 5000 });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Lead has already been converted");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects conversion when the lead has no salesperson", async () => {
    prismaMock.lead.findUnique.mockResolvedValue({
      id: "lead-5",
      status: "NEW",
      salespersonId: null,
    });

    const response = await request(app).post("/leads/lead-5/convert").send({ amount: 5000 });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Lead must be assigned to a salesperson before conversion");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a negative conversion amount", async () => {
    const response = await request(app).post("/leads/lead-6/convert").send({ amount: -1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid conversion data");
    expect(prismaMock.lead.findUnique).not.toHaveBeenCalled();
  });
});
