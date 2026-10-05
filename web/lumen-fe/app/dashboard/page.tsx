"use client";

import {
  CheckCircle2,
  FileText,
  MessageSquare,
  Send,
  UploadCloud,
} from "lucide-react";
import { useMe } from "@/lib/me-context";
import StatusBadge, { type DocStatus } from "@/components/statusBadge";

const STATS = [
  { label: "Documents", value: "12", icon: FileText },
  { label: "Ready to chat", value: "9", icon: CheckCircle2 },
  { label: "Conversations", value: "4", icon: MessageSquare },
];

const SAMPLE_DOCS: { title: string; meta: string; status: DocStatus }[] = [
  { title: "Billing-policy.pdf", meta: "PDF, 24 pages", status: "ready" },
  { title: "Onboarding-handbook.docx", meta: "Word, 41 pages", status: "processing" },
  { title: "Q3-roadmap.pdf", meta: "PDF, 12 pages", status: "queued" },
  { title: "scanned-contract.pdf", meta: "PDF, could not read text", status: "failed" },
];

export default function Overview() {
  const { me, workspace } = useMe();
  const firstName = (me.name ?? me.email).split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {firstName}</h1>
        <p className="mt-1 text-[#14142B]/55">
          You are working in <span className="font-medium text-[#14142B]">{workspace.name}</span>.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {STATS.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-[#D9DCF5] bg-white p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#4F46E5]">
              <Icon size={20} />
            </div>
            <p className="mt-4 text-3xl font-bold">{value}</p>
            <p className="text-sm text-[#14142B]/50">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Documents */}
        <section className="rounded-2xl border border-[#D9DCF5] bg-white p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent documents</h2>
            <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-xs font-medium text-[#633806]">
              Sample data
            </span>
          </div>

          <ul className="mt-4 divide-y divide-[#D9DCF5]">
            {SAMPLE_DOCS.map((d) => (
              <li key={d.title} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#4F46E5]">
                    <FileText size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="truncate text-xs text-[#14142B]/45">{d.meta}</p>
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-col items-center rounded-2xl border-2 border-dashed border-[#D9DCF5] bg-[#F6F7FF] px-6 py-8 text-center">
            <UploadCloud className="text-[#4F46E5]/60" size={30} />
            <p className="mt-2 text-sm font-medium">Drop files here to upload</p>
            <p className="mt-1 text-xs text-[#14142B]/45">PDF, DOCX, TXT. Uploads arrive in Week 6.</p>
          </div>
        </section>

        {/* Chat preview */}
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
              placeholder="Chat opens in Week 10"
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