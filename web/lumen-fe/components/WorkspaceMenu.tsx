
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  FolderKanban,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
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

  const menuRef = useRef<HTMLDivElement>(null);
  const current = workspaces.find((w) => w.id === currentId);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setCreating(false);
    setName("");
    setError(null);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName || busy) return;

    setBusy(true);
    setError(null);

    try {
      const ws = await createWorkspace(trimmedName);
      onCreated(ws);
      close();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setBusy(false);
    }
  };

  const initials = (label: string) =>
    label
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  return (
    <div ref={menuRef} className="relative min-w-0">
      {/* Workspace switcher trigger */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={[
          "group flex w-full min-w-0 items-center gap-3 rounded-xl border p-2.5 text-left",
          "transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#5145CD]/20",
          open
            ? "border-[#CFC8F5] bg-[#F8F7FF]"
            : "border-[#E9E7F2] bg-white hover:border-[#D8D2F3] hover:bg-[#FCFBFF]",
        ].join(" ")}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5145CD] text-xs font-semibold text-white shadow-sm shadow-[#5145CD]/15">
          {current ? initials(current.name) : <FolderKanban size={18} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9291A7]">
            Current workspace
          </span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-[#292842]">
            {current?.name ?? "Select workspace"}
          </span>
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-[#9291A7] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label="Workspace switcher"
          className="absolute left-0 top-full z-50 mt-2 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#E7E4F2] bg-white shadow-[0_18px_60px_-20px_rgba(34,29,83,0.24)] sm:w-[340px]"
        >
          {/* Dropdown header */}
          <div className="flex items-center justify-between border-b border-[#F0EEF6] px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-[#292842]">
                Your workspaces
              </p>
              <p className="mt-0.5 text-xs text-[#9291A7]">
                Switch between your projects
              </p>
            </div>

            <button
              type="button"
              onClick={close}
              aria-label="Close workspace menu"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9291A7] transition hover:bg-[#F3F1FA] hover:text-[#5145CD]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Workspace options */}
          <div className="max-h-64 overflow-y-auto p-2">
            {workspaces.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[#9291A7]">
                No workspaces available.
              </p>
            ) : (
              workspaces.map((w, index) => {
                const selected = w.id === currentId;

                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      onSelect(w.id);
                      close();
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                      selected
                        ? "bg-[#F1EFFF]"
                        : "hover:bg-[#FAF9FD]"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${
                        selected
                          ? "bg-[#5145CD] text-white"
                          : [
                              "bg-[#E9E7FF] text-[#5145CD]",
                              "bg-[#DDF4EA] text-[#187D5D]",
                              "bg-[#FCEAD9] text-[#A45D24]",
                              "bg-[#E2EFFD] text-[#356BA6]",
                            ][index % 4]
                      }`}
                    >
                      {initials(w.name)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#33324D]">
                        {w.name}
                      </span>
                      <span className="mt-1 block text-xs capitalize text-[#9291A7]">
                        {w.role}
                      </span>
                    </span>

                    {selected ? (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#5145CD]">
                        <Check size={15} strokeWidth={2.5} />
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[#AAA7BD] opacity-0 transition group-hover:opacity-100">
                        Select
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-[#F0EEF6] p-2">
            {creating ? (
              <form
                onSubmit={submit}
                className="rounded-xl bg-[#F8F7FC] p-3.5"
              >
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9E7FF] text-[#5145CD]">
                    <Plus size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#292842]">
                      New workspace
                    </p>
                    <p className="text-xs text-[#9291A7]">
                      Give your project a name
                    </p>
                  </div>
                </div>

                <label
                  htmlFor="workspace-name"
                  className="mb-1.5 block text-xs font-medium text-[#55546E]"
                >
                  Workspace name
                </label>

                <input
                  id="workspace-name"
                  autoFocus
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Healthcare Research"
                  className="h-11 w-full rounded-xl border border-[#E5E3EF] bg-white px-3.5 text-sm text-[#292842] outline-none transition placeholder:text-[#B0AEC0] focus:border-[#8275E8] focus:ring-4 focus:ring-[#5145CD]/10"
                />

                {error && (
                  <p role="alert" className="mt-2 text-xs text-red-700">
                    {error}
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={busy || !name.trim()}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#5145CD] px-3 text-sm font-semibold text-white transition hover:bg-[#4035B5] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? (
                      "Creating..."
                    ) : (
                      <>
                        Create workspace
                        <ArrowRightIcon />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCreating(false);
                      setName("");
                      setError(null);
                    }}
                    className="h-10 rounded-xl px-3 text-sm font-medium text-[#777791] transition hover:bg-white hover:text-[#292842] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setError(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#F5F3FF]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-[#CBC4F1] bg-[#F8F7FF] text-[#5145CD]">
                  <Plus size={19} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#5145CD]">
                    Create a workspace
                  </span>
                  <span className="mt-0.5 block text-xs text-[#9291A7]">
                    Start a separate knowledge base
                  </span>
                </span>

                <Sparkles size={16} className="text-[#9C91E8]" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ArrowRightIcon() {
  return <span aria-hidden="true">→</span>;
}
