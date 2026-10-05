export type DocStatus = "queued" | "processing" | "ready" | "failed";

const STYLES: Record<DocStatus, { label: string; cls: string; dot: string }> = {
  queued: { label: "Queued", cls: "bg-[#F3F4F6] text-[#4B5563]", dot: "bg-[#9CA3AF]" },
  processing: { label: "Processing", cls: "bg-[#EEF0FF] text-[#312E81]", dot: "bg-[#4F46E5] animate-pulse" },
  ready: { label: "Ready", cls: "bg-[#D1FAE5] text-[#065F46]", dot: "bg-[#10B981]" },
  failed: { label: "Failed", cls: "bg-[#FEE2E2] text-[#991B1B]", dot: "bg-[#EF4444]" },
};

export default function StatusBadge({ status }: { status: DocStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}