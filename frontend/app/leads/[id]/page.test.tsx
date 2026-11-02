import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import LeadDetailsPage from "./page";

const { useSWRMock, mutateMock } = vi.hoisted(() => ({
  useSWRMock: vi.fn(),
  mutateMock: vi.fn(),
}));

vi.mock("swr", () => ({
  default: useSWRMock,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "lead-1" }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const testLead = {
  id: "lead-1",
  name: "Jordan Lee",
  email: "jordan@example.com",
  phone: "555-0104",
  status: "NEW" as const,
  createdAt: "2026-11-02T10:00:00.000Z",
  salesperson: { id: "salesperson-1", name: "Alex Morgan" },
  tasks: [],
  activityLogs: [],
  contact: null,
  deal: null,
};

function renderDetailsPage() {
  useSWRMock.mockReturnValue({
    data: testLead,
    error: undefined,
    isLoading: false,
    mutate: mutateMock,
  });

  return render(<LeadDetailsPage />);
}

describe("lead details actions", () => {
  it("posts a note and refreshes the lead", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "activity-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mutateMock.mockResolvedValue(undefined);

    renderDetailsPage();

    fireEvent.change(screen.getByLabelText("Log a call or note"), {
      target: { value: "Called and scheduled a follow-up." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add activity" }));

    await screen.findByRole("status");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/leads/lead-1/activity",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          description: "Called and scheduled a follow-up.",
        }),
      }),
    );
    expect(mutateMock).toHaveBeenCalled();
  });

  it("updates the status and refreshes the lead", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...testLead, status: "WORKING" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mutateMock.mockResolvedValue(undefined);

    renderDetailsPage();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "WORKING" },
    });

    await screen.findByRole("status");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3001/leads/lead-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "WORKING" }),
        }),
      );
    });
    expect(mutateMock).toHaveBeenCalled();
  });
});