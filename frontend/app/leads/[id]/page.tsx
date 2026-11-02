"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";

type LeadDetails = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "NEW" | "WORKING" | "CONVERTED";
  createdAt: string;
  salesperson: { id: string; name: string } | null;
  tasks: {
    id: string;
    type: string;
    description: string;
    dueDate: string;
    status: string;
  }[];
  activityLogs: {
    id: string;
    action: string;
    description: string;
    issuerId: string | null;
    timestamp: string;
  }[];
  contact: { id: string; address: string | null } | null;
  deal: { id: string; amount: number; status: string } | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load data");
  return response.json() as Promise<T>;
}

function LeadDetailsContent() {
  const params = useParams<{ id: string }>();
  const leadId = params.id;

  const {
    data: lead,
    error: loadError,
    isLoading: loading,
    mutate: refreshLead,
  } = useSWR<LeadDetails>(`${API_URL}/leads/${leadId}`, fetcher);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const visibleError = error || loadError?.message || "";

  async function submitJson(
    path: string,
    method: "POST" | "PATCH",
    payload: Record<string, unknown>,
  ) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Request failed");
      }

      setMessage("Saved successfully.");
      await refreshLead();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const description = String(formData.get("description") ?? "").trim();

    if (await submitJson(`/leads/${leadId}/activity`, "POST", { description })) {
      form.reset();
    }
  }

  async function changeStatus(event: FormEvent<HTMLSelectElement>) {
    await submitJson(`/leads/${leadId}`, "PATCH", {
      status: event.currentTarget.value,
    });
  }

  async function convertLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const amount = Number(formData.get("amount") ?? 0);
    const address = String(formData.get("address") ?? "").trim();

    const converted = await submitJson(`/leads/${leadId}/convert`, "POST", {
      amount,
      ...(address ? { address } : {}),
    });

    if (converted) form.reset();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] p-8 text-slate-600">
        Loading lead…
      </main>
    );
  }

  if (!lead) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] p-8">
        <Link href="/" className="text-blue-700 hover:underline">
          ← Back to inbox
        </Link>
        <p className="mt-6 text-red-700">{visibleError || "Lead not found."}</p>
      </main>
    );
  }

  const timeline = [...lead.activityLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/" className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to inbox
        </Link>

        <header className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                Lead details
              </p>
              <h1 className="mt-2 text-3xl font-bold">{lead.name}</h1>
              <p className="mt-2 text-slate-600">
                {lead.email} · {lead.phone}
              </p>
            </div>

            <div className="min-w-44">
              <label htmlFor="status" className="mb-2 block text-sm font-medium text-slate-600">
                Status
              </label>
              <select
                id="status"
                value={lead.status}
                disabled={lead.status === "CONVERTED" || saving}
                onChange={changeStatus}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
              >
                <option value="NEW">New</option>
                <option value="WORKING">Working</option>
                <option value="CONVERTED">Converted</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Assigned to</p>
              <p className="mt-1 font-medium">
                {lead.salesperson?.name ?? "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Created</p>
              <p className="mt-1 font-medium">
                {new Date(lead.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Lead ID</p>
              <p className="mt-1 truncate font-mono text-sm">{lead.id}</p>
            </div>
          </div>
        </header>

        {visibleError && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {visibleError}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {message}
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Activity timeline</h2>

            {lead.status !== "CONVERTED" && (
              <form onSubmit={addNote} className="mt-4">
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-slate-600"
                >
                  Log a call or note
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={3}
                  placeholder="What happened?"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
                />
                <button
                  disabled={saving}
                  className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Add activity"}
                </button>
              </form>
            )}

            <div className="mt-6 space-y-5">
              {timeline.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No activity has been logged yet.
                </p>
              ) : (
                timeline.map((item) => (
                  <article key={item.id} className="border-l-2 border-blue-200 pl-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{item.description}</p>
                      <time className="text-xs text-slate-500">
                        {new Date(item.timestamp).toLocaleString()}
                      </time>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                      {item.action}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Follow-up tasks</h2>

              {lead.tasks.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No tasks yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {lead.tasks.map((task) => (
                    <li key={task.id} className="rounded-xl bg-slate-50 p-4">
                      <p className="font-medium">{task.description}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {task.type} · {task.status} · Due{" "}
                        {new Date(task.dueDate).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {lead.status === "CONVERTED" ? (
              <section className="rounded-2xl border border-green-200 bg-green-50 p-6">
                <h2 className="text-lg font-semibold text-green-900">Converted</h2>
                <p className="mt-2 text-sm text-green-800">
                  Deal amount: {lead.deal?.amount ?? 0}
                </p>
                {lead.contact?.address && (
                  <p className="mt-1 text-sm text-green-800">{lead.contact.address}</p>
                )}
              </section>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Convert to customer</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Creates a contact and deal for this lead.
                </p>

                {!lead.salesperson && (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    This lead needs a salesperson before it can be converted.
                  </p>
                )}

                <form onSubmit={convertLead} className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-600">
                    Deal amount
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue="0"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-600">
                    Contact address
                    <input
                      name="address"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Optional"
                    />
                  </label>
                  <button
                    disabled={saving || !lead.salesperson}
                    className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Convert lead"}
                  </button>
                </form>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LeadDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f5f7fb] p-8 text-slate-600">
          Loading lead…
        </main>
      }
    >
      <LeadDetailsContent />
    </Suspense>
  );
}