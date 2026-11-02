"use client";

import { FormEvent, useState } from "react";
import useSWR from "swr";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "NEW" | "WORKING" | "CONVERTED";
  salesperson?: { name: string } | null;
  createdAt: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load data");
  return response.json() as Promise<T>;
}

export default function Home() {
  const {
    data: leads = [],
    error: loadError,
    isLoading: loading,
    mutate: refreshLeads,
  } = useSWR<Lead[]>(`${API_URL}/leads`, fetcher);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const visibleError = error || loadError?.message || "";

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const newLead = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    };

    try {
      const response = await fetch(`${API_URL}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLead),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Could not create lead");
      }

      form.reset();
      await refreshLeads();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create lead");
    } finally {
      setSaving(false);
    }
  }

  const openLeads = leads.filter((lead) => lead.status !== "CONVERTED").length;

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-9 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">Keyloop · Sales workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Lead inbox</h1>
            <p className="mt-1 text-slate-500">Review prospects and keep every follow-up moving.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Open leads</p>
            <p className="mt-1 text-2xl font-semibold">{openLeads}</p>
          </div>
        </header>

        {visibleError && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {visibleError}
          </div>
        )}

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Add a lead</h2>

          <form onSubmit={createLead} className="mt-4 grid gap-3 sm:grid-cols-4">
            <input
              required
              name="name"
              placeholder="Full name"
              className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600"
            />
            <input
              required
              name="email"
              type="email"
              placeholder="Email address"
              className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600"
            />
            <input
              required
              name="phone"
              placeholder="Phone number"
              className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600"
            />
            <button
              disabled={saving}
              className="rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? "Adding…" : "Add lead"}
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="font-semibold">All leads</h2>
              <p className="mt-1 text-sm text-slate-500">
                {leads.length} {leads.length === 1 ? "record" : "records"}
              </p>
            </div>

            <button
              onClick={() => void refreshLeads()}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="px-6 py-10 text-center text-slate-500">Loading leads…</p>
          ) : leads.length === 0 ? (
            <p className="px-6 py-10 text-center text-slate-500">No leads yet. Add one above to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Lead</th>
                    <th className="px-6 py-3 font-semibold">Phone</th>
                    <th className="px-6 py-3 font-semibold">Owner</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <a href={`/leads/${lead.id}`} className="font-semibold text-blue-700 hover:underline">
                          {lead.name}
                        </a>
                        <p className="mt-1 text-slate-500">{lead.email}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{lead.phone}</td>
                      <td className="px-6 py-4 text-slate-600">{lead.salesperson?.name ?? "Assigning…"}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                          {lead.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
