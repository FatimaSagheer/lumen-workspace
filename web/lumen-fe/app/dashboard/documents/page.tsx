
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Link2,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
  Upload,
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

  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;

    try {
      const [s, page] = await Promise.all([
        documentStats(workspace.id),
        listDocuments(workspace.id, { limit: 5 }),
      ]);

      if (my !== seq.current) return;

      setStats(s);
      setRecent(page.items);
      setError(null);
    } catch (e) {
      if (my === seq.current) {
        setError(
          e instanceof Error ? e.message : "Something went wrong"
        );
      }
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [workspace.id]);

  useEffect(() => {
    setLoading(true);
    setStats(null);
    setRecent([]);
    setError(null);
    void load();

    return () => {
      // Prevent an older workspace request from updating this page.
      seq.current++;
    };
  }, [load]);

  const hasActive =
    stats !== null && stats.queued + stats.processing > 0;

  useEffect(() => {
    if (!hasActive) return;

    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [hasActive, load]);

  const cards = [
    {
      label: "Total documents",
      value: stats?.total,
      note: "Across this workspace",
      icon: FileText,
      iconClass: "bg-[#E9E7FF] text-[#5145CD]",
    },
    {
      label: "Ready to use",
      value: stats?.ready,
      note: "Available for retrieval",
      icon: CheckCircle2,
      iconClass: "bg-[#E1F5EC] text-[#16805D]",
    },
    {
      label: "Processing",
      value: stats ? stats.queued + stats.processing : undefined,
      note: "Being prepared",
      icon: Clock3,
      iconClass: "bg-[#FFF0D6] text-[#A96812]",
    },
    {
      label: "Needs attention",
      value: stats?.failed,
      note: "Failed documents",
      icon: AlertTriangle,
      iconClass: "bg-[#FCE8E7] text-[#C44743]",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-8 pb-10 text-[#202139]">
      {/* Page heading */}
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#777791]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6255DF]" />
            Workspace overview
          </div>

          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-[#202139] sm:text-[38px]">
            Good to see you, {firstName}.
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#777791] sm:text-base">
            Here&apos;s what&apos;s happening in{" "}
            <span className="font-semibold text-[#393852]">
              {workspace.name}
            </span>
            .
          </p>
        </div>

        <Link
          href="/dashboard/documents"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#5145CD] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4035B5] focus:outline-none focus:ring-2 focus:ring-[#5145CD]/40 focus:ring-offset-2"
        >
          <Plus size={17} />
          Add documents
        </Link>
      </header>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Couldn&apos;t refresh your workspace</p>
            <p className="mt-1">{error}</p>
            <button
              onClick={() => void load()}
              className="mt-2 font-semibold underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Compact metrics */}
      <section
        aria-label="Document statistics"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {cards.map(({ label, value, note, icon: Icon, iconClass }) => (
          <article
            key={label}
            className="group rounded-2xl border border-[#E9E7F2] bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#D5D0F5] hover:shadow-[0_10px_30px_-20px_rgba(43,35,110,0.28)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#777791]">
                  {label}
                </p>
                <p className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.05em] text-[#202139]">
                  {loading && value === undefined ? (
                    <span className="inline-block h-8 w-12 animate-pulse rounded-md bg-[#F0EFF7]" />
                  ) : (
                    value ?? "—"
                  )}
                </p>
              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${iconClass}`}
              >
                <Icon size={20} strokeWidth={1.8} />
              </div>
            </div>

            <p className="mt-4 text-xs text-[#9291A7]">{note}</p>
          </article>
        ))}
      </section>

      {/* Main content */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.9fr)]">
        {/* Recent documents */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-[#E9E7F2] bg-white">
          <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[#25243F]">
                Recent documents
              </h2>
              <p className="mt-1 text-sm text-[#9291A7]">
                Your workspace&apos;s latest additions
              </p>
            </div>

            <Link
              href="/dashboard/documents"
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#5145CD] transition hover:text-[#3930A8]"
            >
              View library <ArrowRight size={15} />
            </Link>
          </div>

          <div className="border-t border-[#F0EEF6]">
            {loading && recent.length === 0 ? (
              <div className="space-y-4 p-6">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex animate-pulse gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#F0EFF7]" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 w-2/3 rounded bg-[#F0EFF7]" />
                      <div className="h-3 w-1/3 rounded bg-[#F5F4F9]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EEFF] text-[#5145CD]">
                  <Upload size={24} strokeWidth={1.7} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-[#25243F]">
                  Your library starts here
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#85849B]">
                  Add documents to build a searchable knowledge base for your
                  workspace.
                </p>
                <Link
                  href="/dashboard/documents"
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#5145CD] px-4 text-sm font-semibold text-white transition hover:bg-[#4035B5]"
                >
                  <Plus size={16} />
                  Add your first document
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-[#F0EEF6]">
                {recent.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 px-5 py-4 transition hover:bg-[#FAF9FE] sm:px-6"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        d.source_type === "url"
                          ? "bg-[#E7F3FF] text-[#3674B8]"
                          : "bg-[#F0EEFF] text-[#5145CD]"
                      }`}
                    >
                      {d.source_type === "url" ? (
                        <Link2 size={18} strokeWidth={1.8} />
                      ) : (
                        <FileText size={18} strokeWidth={1.8} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        title={d.title}
                        className="truncate text-sm font-semibold text-[#33324D]"
                      >
                        {d.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-[#9291A7]">
                        {d.uploaded_by_name ?? "Unknown"}{" "}
                        <span className="mx-1 text-[#D0CEDD]">·</span>
                        {new Date(d.created_at).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <StatusBadge status={d.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!loading && recent.length > 0 && (
              <div className="border-t border-[#F0EEF6] px-5 py-3 sm:px-6">
                <Link
                  href="/dashboard/documents"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#85849B] transition hover:text-[#5145CD]"
                >
                  Browse all documents
                  <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Lumen product preview */}
        <section className="relative overflow-hidden rounded-2xl border border-[#E1DDF9] bg-[#F5F3FF]">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#DCD5FF]/50 blur-3xl" />

          <div className="relative border-b border-[#E5E0FB] px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-[#5145CD] shadow-sm ring-1 ring-[#E8E3FC]">
                <Sparkles size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold tracking-tight text-[#25243F]">
                  Meet Lumen
                </h2>
                <p className="mt-0.5 text-xs text-[#8580A6]">
                  Your documents, ready to answer.
                </p>
              </div>

              <span className="rounded-full border border-[#DDD6FE] bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6657C7]">
                Preview
              </span>
            </div>
          </div>

          <div className="relative space-y-5 p-5 sm:p-6">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#5145CD] ring-1 ring-[#E8E3FC]">
                <MessageSquareText size={15} />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8580A6]">
                  Ask your knowledge base
                </p>
                <p className="mt-2 max-w-[290px] text-sm leading-6 text-[#373450]">
                  What would you like to find out from your documents?
                </p>
              </div>
            </div>

            <div className="ml-10 rounded-xl border border-[#E5E0FB] bg-white/85 p-3.5">
              <p className="text-xs font-medium text-[#8580A6]">
                Example question
              </p>
              <p className="mt-1.5 text-sm font-medium leading-6 text-[#373450]">
                Summarize the key points in my research paper.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F0EEF8] pt-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F0EEFF] px-2.5 py-1.5 text-[11px] font-medium text-[#5145CD]">
                  <FileText size={13} />
                  Source citations
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-[#85849B]">
                  <CheckCircle2 size={13} />
                  Grounded answers
                </span>
              </div>
            </div>

            <div className="ml-10 flex items-start gap-2.5 rounded-xl border border-dashed border-[#D9D1FA] bg-white/40 p-3.5">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-[#7666DC]" />
              <p className="text-xs leading-5 text-[#777291]">
                Lumen will retrieve relevant passages from your workspace and
                use them to answer with sources you can verify.
              </p>
            </div>
          </div>

          <div className="relative border-t border-[#E5E0FB] bg-white/45 px-5 py-4 sm:px-6">
            <Link
              href="/dashboard/documents"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5145CD] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4035B5]"
            >
              Prepare your knowledge base
              <ArrowRight size={16} />
            </Link>
            <p className="mt-2.5 text-center text-[11px] text-[#9290AB]">
              Upload documents to get started
            </p>
          </div>
        </section>
      </div>

      {/* A restrained, useful footer action strip */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/documents"
          className="group flex items-center gap-4 rounded-2xl border border-[#E9E7F2] bg-white p-4 transition hover:border-[#D5D0F5] hover:shadow-sm"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0EEFF] text-[#5145CD]">
            <Upload size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#33324D]">
              Grow your library
            </p>
            <p className="mt-1 text-xs text-[#9291A7]">
              Add PDFs, documents, or web links.
            </p>
          </div>
          <ArrowDownRight
            size={17}
            className="text-[#AAA7C0] transition group-hover:translate-x-0.5 group-hover:text-[#5145CD]"
          />
        </Link>

        <div className="flex items-center gap-4 rounded-2xl border border-[#E9E7F2] bg-white p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E7F5EF] text-[#16805D]">
            <CheckCircle2 size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#33324D]">
              Workspace at a glance
            </p>
            <p className="mt-1 truncate text-xs text-[#9291A7]">
              {workspace.name} ·{" "}
              {stats?.ready ?? 0} documents ready for retrieval
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
