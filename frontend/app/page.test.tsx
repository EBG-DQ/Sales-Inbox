import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Home from "./page";
import { SWRConfig } from "swr";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderHome() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Home />
    </SWRConfig>,
  );
}

describe("lead inbox", () => {
  it("shows leads returned by the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: "lead-1",
            name: "Morgan Chen",
            email: "morgan@example.com",
            phone: "555-0102",
            status: "NEW",
            salesperson: { name: "Alex Morgan" },
            createdAt: "2026-11-02T10:00:00.000Z",
          },
        ],
      }),
    );

    renderHome();

    expect(await screen.findByText("Morgan Chen")).toBeInTheDocument();
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("submits a lead and refreshes the list", async () => {
    const newLead = {
      id: "lead-2",
      name: "Taylor Kim",
      email: "taylor@example.com",
      phone: "555-0103",
      status: "NEW",
      salesperson: { name: "Jamie Lee" },
      createdAt: "2026-11-02T10:00:00.000Z",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => newLead })
      .mockResolvedValueOnce({ ok: true, json: async () => [newLead] });

    vi.stubGlobal("fetch", fetchMock);
    renderHome();

    expect(await screen.findByText("No leads yet. Add one above to get started.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Full name"), {
      target: { value: "Taylor Kim" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "taylor@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Phone number"), {
      target: { value: "555-0103" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add lead" }));

    expect(await screen.findByText("Taylor Kim")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  });
});
