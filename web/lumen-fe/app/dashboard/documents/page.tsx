"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Link2, Pencil, Search, Trash2 } from "lucide-react";
import StatusBadge from "@/components/statusBadge";
import { useMe } from "@/lib/me-context";
import {
  createDocument,
  deleteDocument,
  listDocuments,
  renameDocument,
  type Doc,
  type DocStatus,
} from "@/lib/api";

const PAGE = 20; // rows per page
const POLL_MS = 2000; // how often to refresh while documents are processing

const TABS: { label: string; value: DocStatus | null }[] = [
  { label: "All", value: null },
  { label: "Queued", value: "queued" },
  { label: "Processing", value: "processing" },
  { label: "Ready", value: "ready" },
  { label: "Failed", value: "failed" },
];

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

// Returns `value`, but only after it has stopped changing for `delay` ms.
// Used so we search once per pause in typing, not once per keystroke.
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t); // cancel the old timer on every keystroke
  }, [value, delay]);
  return debounced;
}

export default function DocumentsPage() {
  const { me, workspace } = useMe();

  // ---- The list and what it shows ----
  const [docs, setDocs] = useState<Doc[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Filters ----
  const [statusFilter, setStatusFilter] = useState<DocStatus | null>(null);
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);

  // ---- Add form ----
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<"upload" | "url">("upload");
  const [sourceUrl, setSourceUrl] = useState("");

  // ---- Inline rename ----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // ---- Refs: values we need to READ inside callbacks without re-creating them ----
  const seq = useRef(0); // numbers each full load, so old answers can be ignored
  const lengthRef = useRef(0); // how many rows are on screen right now
  const keyRef = useRef(""); // identifies the current workspace + filters
  const pendingRef = useRef(0); // how many optimistic adds are still in flight
  const loadingMoreRef = useRef(false);
  const editDone = useRef(false); // stops rename from saving twice (Enter then blur)

  const key = `${workspace.id}|${statusFilter}|${q}`;
  useEffect(() => {
    keyRef.current = key;
    lengthRef.current = docs.length;
  });

  // ---- Load the first page (or silently refresh what is on screen) ----
  const load = useCallback(
    async (silent = false) => {
      // A silent refresh must not cancel a full load, so only full loads bump the number
      const my = silent ? seq.current : ++seq.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        // A silent refresh asks for as many rows as are already visible
        const size = silent ? Math.min(Math.max(lengthRef.current, PAGE), 100) : PAGE;
        const page = await listDocuments(workspace.id, {
          limit: size,
          status: statusFilter,
          q,
        });
        if (my !== seq.current) return; // a newer load started, so ignore this answer
        setDocs(page.items);
        setNextCursor(page.next_cursor);
      } catch (e) {
        if (my === seq.current && !silent) setError(msg(e));
      } finally {
        if (my === seq.current && !silent) setLoading(false);
      }
    },
    [workspace.id, statusFilter, q],
  );

  // Reload from the start whenever the workspace, the tab or the search changes
  useEffect(() => {
    load();
  }, [load]);

  // ---- Live updates: while anything is queued or processing, refresh every 2s ----
  const hasActive = docs.some((d) => d.status === "queued" || d.status === "processing");
  useEffect(() => {
    if (!hasActive) return; // nothing is changing, so do nothing
    const id = setInterval(() => {
      if (pendingRef.current > 0 || loadingMoreRef.current) return; // do not disturb
      load(true);
    }, POLL_MS);
    return () => clearInterval(id); // stop when the effect re-runs or the page closes
  }, [hasActive, load]);

  // ---- Load more ----
  const loadMore = async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    const myKey = keyRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await listDocuments(workspace.id, {
        limit: PAGE,
        cursor: nextCursor,
        status: statusFilter,
        q,
      });
      if (myKey !== keyRef.current) return; // filters changed while we waited
      setDocs((prev) => {
        const seen = new Set(prev.map((d) => d.id));
        return [...prev, ...page.items.filter((d) => !seen.has(d.id))];
      });
      setNextCursor(page.next_cursor);
    } catch (e) {
      setError(msg(e));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  // ---- Add (optimistic: the row appears at once, then is swapped for the real one) ----
  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const u = sourceUrl.trim();
    const type = sourceType;
    if (!t) return;
    setError(null);

    // Only show the temporary row if it would appear in the current view anyway
    const showTemp = !q && (statusFilter === null || statusFilter === "queued");
    const now = new Date().toISOString();
    const temp: Doc = {
      id: `temp-${Date.now()}`,
      workspace_id: workspace.id,
      title: t,
      source_type: type,
      source_url: type === "url" ? u : null,
      mime_type: null,
      size_bytes: null,
      status: "queued",
      error: null,
      chunk_count: 0,
      uploaded_by: me.id,
      uploaded_by_name: me.name ?? me.email,
      created_at: now,
      updated_at: now,
      processed_at: null,
    };

    pendingRef.current++;
    if (showTemp) setDocs((prev) => [temp, ...prev]);
    setTitle("");
    setSourceUrl("");

    try {
      const created = await createDocument(workspace.id, {
        title: t,
        source_type: type,
        source_url: type === "url" ? u : undefined,
      });
      if (showTemp) {
        setDocs((prev) => prev.map((d) => (d.id === temp.id ? created : d)));
      } else {
        await load(true);
      }
    } catch (err) {
      // Roll back: remove the temporary row and give the typed values back
      setDocs((prev) => prev.filter((d) => d.id !== temp.id));
      setTitle(t);
      setSourceUrl(u);
      setError(msg(err));
    } finally {
      pendingRef.current--;
    }
  };

  // ---- Delete ----
  const onDelete = async (d: Doc) => {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    setError(null);
    try {
      await deleteDocument(workspace.id, d.id);
      setDocs((prev) => prev.filter((x) => x.id !== d.id));
    } catch (err) {
      setError(msg(err));
    }
  };

  // ---- Rename ----
  const startEdit = (d: Doc) => {
    editDone.current = false;
    setEditingId(d.id);
    setEditTitle(d.title);
  };

  const cancelEdit = () => {
    editDone.current = true;
    setEditingId(null);
  };

  const saveEdit = async (d: Doc) => {
    if (editDone.current) return;
    editDone.current = true;
    const t = editTitle.trim();
    setEditingId(null);
    if (!t || t === d.title) return;
    try {
      const updated = await renameDocument(workspace.id, d.id, t);
      setDocs((prev) =>
        prev.map((x) =>
          x.id === d.id ? { ...x, title: updated.title, updated_at: updated.updated_at } : x,
        ),
      );
    } catch (err) {
      setError(msg(err));
    }
  };

  // Admins can change anything. Members can change only what they uploaded.
  // (The server enforces this too. This only decides which buttons to show.)
  const canModify = (d: Doc) => workspace.role === "admin" || d.uploaded_by === me.id;

  const filtering = statusFilter !== null || q !== "";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="mt-1 text-[#14142B]/55">
          Files and pages in{" "}
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

      {/* ---- Add form ---- */}
      <form
        onSubmit={onAdd}
        className="flex flex-col gap-3 rounded-2xl border border-[#D9DCF5] bg-white p-4 sm:flex-row"
      >
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Document title"
          className="h-11 flex-1 rounded-xl border border-[#14142B]/10 px-4 text-sm outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
        />
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as "upload" | "url")}
          className="h-11 rounded-xl border border-[#14142B]/10 bg-white px-3 text-sm"
        >
          <option value="upload">Upload</option>
          <option value="url">Web page</option>
        </select>
        {sourceType === "url" && (
          <input
            required
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://example.com/page"
            className="h-11 flex-1 rounded-xl border border-[#14142B]/10 px-4 text-sm outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
          />
        )}
        <button
          type="submit"
          className="h-11 rounded-xl bg-[#4F46E5] px-5 text-sm font-semibold text-white transition hover:bg-[#4338CA]"
        >
          Add
        </button>
      </form>

      {/* ---- Search and status tabs ---- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => setStatusFilter(t.value)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                statusFilter === t.value
                  ? "bg-[#4F46E5] text-white"
                  : "bg-white text-[#14142B]/65 ring-1 ring-[#D9DCF5] hover:bg-[#EEF0FF]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Search
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#14142B]/35"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles"
            className="h-10 w-full rounded-xl border border-[#14142B]/10 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
          />
        </div>
      </div>

      {/* ---- The list ---- */}
      <section className="rounded-2xl border border-[#D9DCF5] bg-white p-6">
        {loading ? (
          <p className="text-sm text-[#14142B]/50">Loading...</p>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <FileText className="text-[#4F46E5]/50" size={32} />
            <p className="mt-3 text-sm font-medium">
              {filtering ? "No documents match" : "No documents yet"}
            </p>
            <p className="mt-1 text-xs text-[#14142B]/45">
              {filtering
                ? "Try a different search or tab."
                : "Add your first document above to get started."}
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[#D9DCF5]">
              {docs.map((d) => {
                const isTemp = d.id.startsWith("temp-");
                const editing = editingId === d.id;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#4F46E5]">
                        {d.source_type === "url" ? <Link2 size={19} /> : <FileText size={19} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        {editing ? (
                          <input
                            autoFocus
                            value={editTitle}
                            maxLength={200}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => saveEdit(d)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(d);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="h-8 w-full rounded-lg border border-[#4F46E5] px-2 text-sm outline-none"
                          />
                        ) : (
                          <p className="truncate text-sm font-medium">{d.title}</p>
                        )}
                        <p className="truncate text-xs text-[#14142B]/45">
                          {d.uploaded_by_name ?? "Unknown"} -{" "}
                          {new Date(d.created_at).toLocaleDateString()}
                          {d.status === "ready" && ` - ${d.chunk_count} chunks`}
                        </p>
                        {d.status === "failed" && d.error && (
                          <p className="truncate text-xs text-[#B91C1C]">{d.error}</p>
                        )}
                      </div>
                    </div>

                    <StatusBadge status={d.status} />

                    {canModify(d) && !isTemp && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => startEdit(d)}
                          aria-label={`Rename ${d.title}`}
                          className="rounded-lg p-2 text-[#14142B]/45 transition hover:bg-[#EEF0FF] hover:text-[#4F46E5]"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(d)}
                          aria-label={`Delete ${d.title}`}
                          className="rounded-lg p-2 text-[#14142B]/45 transition hover:bg-[#FEE2E2] hover:text-[#991B1B]"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {nextCursor && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-xl border border-[#D9DCF5] px-5 py-2 text-sm font-medium transition hover:bg-[#EEF0FF] disabled:opacity-60"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}