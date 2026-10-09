"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Link2,
  Send,
} from "lucide-react";
import StatusBadge from "@/components/statusBadge";
import { useMe } from "@/lib/me-context";
import {
  documentStats,
  listDocuments,
  type Doc,
  type DocStats,
} from "@/lib/api";

const POLL_MS = 3000;

export default function Overview() {
  const { me, workspace } = useMe();
  const firstName = (me.name ?? me.email).split(" ")[0];

  const [stats, setStats] = useState<DocStats | null>(null);
  const [recent, setRecent] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Numbers each request, so an old slow answer can never overwrite a newer one
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      // Both requests run at the same time, which is faster than one after the other
      const [s, page] = await Promise.all([
        documentStats(workspace.id),
        listDocuments(workspace.id, { limit: 4 }),
      ]);
      if (my !== seq.current) return;
      setStats(s);
      setRecent(page.items);
      setError(null);
    } catch (e) {
      if (my === seq.current) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [workspace.id]);

  // Load when the page opens, and again whenever the workspace changes
  useEffect(() => {
    setLoading(true);
    setStats(null);
    setRecent([]);
    load();
  }, [load]);

  // While anything is queued or processing, refresh every few seconds
  const hasActive = stats !== null && stats.queued + stats.processing > 0;
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [hasActive, load]);

  const cards = [
    { label: "Documents", value: stats?.total, icon: FileText, tone: "bg-[#EEF0FF] text-[#4F46E5]" },
    { label: "Ready to chat", value: stats?.ready, icon: CheckCircle2, tone: "bg-[#D1FAE5] text-[#065F46]" },
    {
      label: "In progress",
      value: stats ? stats.queued + stats.processing : undefined,
      icon: Clock,
      tone: "bg-[#FEF3C7] text-[#633806]",
    },
    { label: "Failed", value: stats?.failed, icon: AlertTriangle, tone: "bg-[#FEE2E2] text-[#991B1B]" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {firstName}</h1>
        <p className="mt-1 text-[#14142B]/55">
          You are working in{" "}
          <span className="font-medium text-[#14142B]">{workspace.name}</span>.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/5 px-4 py-3 text-sm text-[#B91C1C]"
        >
          {error}
        </div>
      )}

      {/* Real numbers from /documents/stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-[#D9DCF5] bg-white p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon size={20} />
            </div>
            <p className="mt-4 text-3xl font-bold">{value ?? "-"}</p>
            <p className="text-sm text-[#14142B]/50">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent documents, real data */}
        <section className="rounded-2xl border border-[#D9DCF5] bg-white p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent documents</h2>
            <Link
              href="/dashboard/documents"
              className="flex items-center gap-1 text-sm font-medium text-[#4F46E5] hover:text-[#4338CA]"
            >
              View all <ArrowRight size={15} />
            </Link>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-[#14142B]/50">Loading...</p>
          ) : recent.length === 0 ? (
            <div className="mt-4 flex flex-col items-center rounded-2xl border-2 border-dashed border-[#D9DCF5] bg-[#F6F7FF] px-6 py-8 text-center">
              <FileText className="text-[#4F46E5]/60" size={30} />
              <p className="mt-2 text-sm font-medium">No documents yet</p>
              <Link
                href="/dashboard/documents"
                className="mt-3 rounded-xl bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4338CA]"
              >
                Add your first document
              </Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[#D9DCF5]">
              {recent.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#4F46E5]">
                      {d.source_type === "url" ? <Link2 size={19} /> : <FileText size={19} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      <p className="truncate text-xs text-[#14142B]/45">
                        {d.uploaded_by_name ?? "Unknown"} -{" "}
                        {new Date(d.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Chat is not built yet, so this stays a labeled preview */}
        <section className="rounded-2xl border border-[#D9DCF5] bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ask Lumen</h2>
            <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-xs font-medium text-[#633806]">
              Preview
            </span>
          </div>

          <div className="mt-4 space-y-3 rounded-2xl bg-[#F6F7FF] p-4">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#4F46E5] px-4 py-2.5 text-sm text-white">
                What is our refund policy for annual plans?
              </div>
            </div>
            <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-[#D9DCF5] bg-white px-4 py-2.5 text-sm leading-6">
              Annual plans can be refunded within 30 days of purchase, prorated after that.{" "}
              <span className="rounded-md bg-[#FEF3C7] px-1.5 py-0.5 text-xs text-[#633806]">
                1 Billing-policy.pdf
              </span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              disabled
              placeholder="Chat opens in a later week"
              className="h-11 flex-1 cursor-not-allowed rounded-xl border border-[#D9DCF5] bg-[#F6F7FF] px-4 text-sm placeholder:text-[#14142B]/35"
            />
            <button
              disabled
              aria-label="Send"
              className="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-xl bg-[#4F46E5] text-white opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}