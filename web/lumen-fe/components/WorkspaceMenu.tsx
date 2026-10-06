"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { createWorkspace, type WorkspaceInfo } from "@/lib/api";

export default function WorkspaceMenu({
  workspaces,
  currentId,
  onSelect,
  onCreated,
}: {
  workspaces: WorkspaceInfo[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreated: (ws: WorkspaceInfo) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = workspaces.find((w) => w.id === currentId);

  const close = () => {
    setOpen(false);
    setCreating(false);
    setName("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const ws = await createWorkspace(name.trim());
      onCreated(ws);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative ml-auto lg:ml-0">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        className="flex items-center gap-2 rounded-xl border border-[#D9DCF5] px-3 py-2 text-sm font-medium transition hover:bg-[#EEF0FF]"
      >
        <span className="max-w-[180px] truncate">{current?.name}</span>
        <span className="rounded-full bg-[#EEF0FF] px-2 py-0.5 text-xs font-medium text-[#4F46E5]">
          {current?.role}
        </span>
        <ChevronDown size={16} className="text-[#14142B]/45" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-xl border border-[#D9DCF5] bg-white p-1 shadow-lg lg:left-auto lg:right-0">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  onSelect(w.id);
                  close();
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-[#EEF0FF]"
              >
                <span className="truncate">{w.name}</span>
                {w.id === currentId && <Check size={16} className="text-[#4F46E5]" />}
              </button>
            ))}

            <div className="my-1 border-t border-[#D9DCF5]" />

            {creating ? (
              <form onSubmit={submit} className="space-y-2 p-2">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="Workspace name"
                  className="h-10 w-full rounded-lg border border-[#14142B]/10 px-3 text-sm outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
                />
                {error && <p className="text-xs text-[#B91C1C]">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy || !name.trim()}
                    className="h-9 flex-1 rounded-lg bg-[#4F46E5] text-sm font-semibold text-white hover:bg-[#4338CA] disabled:opacity-50"
                  >
                    {busy ? "Creating..." : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="h-9 rounded-lg px-3 text-sm text-[#14142B]/60 hover:bg-[#EEF0FF]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#4F46E5] hover:bg-[#EEF0FF]"
              >
                <Plus size={16} /> Create workspace
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
