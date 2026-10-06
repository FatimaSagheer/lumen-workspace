"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Trash2, UserPlus } from "lucide-react";
import { useMe } from "@/lib/me-context";
import {
  changeRole,
  createInvite,
  listInvites,
  listMembers,
  removeMember,
  type Invite,
  type Member,
} from "@/lib/api";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export default function MembersPage() {
  const { me, workspace } = useMe();
  const isAdmin = workspace.role === "admin";

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setMembers(await listMembers(workspace.id));
      setInvites(isAdmin ? await listInvites(workspace.id) : []);
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, [workspace.id, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setLink(null);
    try {
      const inv = await createInvite(workspace.id, email.trim(), role);
      setLink(`${window.location.origin}/accept-invite?token=${inv.invite_token}`);
      setEmail("");
      await load();
    } catch (err) {
      setError(msg(err));
    } finally {
      setSending(false);
    }
  };

  const onRole = async (m: Member, next: "admin" | "member") => {
    setError(null);
    try {
      await changeRole(workspace.id, m.user_id, next);
    } catch (err) {
      setError(msg(err));
    }
    await load();
  };

  const onRemove = async (m: Member) => {
    const self = m.user_id === me.id;
    if (!window.confirm(self ? "Leave this workspace?" : `Remove ${m.email}?`)) return;
    setError(null);
    try {
      await removeMember(workspace.id, m.user_id);
      if (self) {
        localStorage.removeItem("workspace_id");
        window.location.assign("/dashboard");
        return;
      }
      await load();
    } catch (err) {
      setError(msg(err));
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <p className="mt-1 text-[#14142B]/55">
          People with access to <span className="font-medium text-[#14142B]">{workspace.name}</span>.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/5 px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      {isAdmin && (
        <section className="rounded-2xl border border-[#D9DCF5] bg-white p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserPlus size={19} className="text-[#4F46E5]" /> Invite someone
          </h2>
          <form onSubmit={onInvite} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="h-11 flex-1 rounded-xl border border-[#14142B]/10 px-4 text-sm outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/10"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "admin")}
              className="h-11 rounded-xl border border-[#14142B]/10 bg-white px-3 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={sending}
              className="h-11 rounded-xl bg-[#4F46E5] px-5 text-sm font-semibold text-white transition hover:bg-[#4338CA] disabled:opacity-60"
            >
              {sending ? "Creating..." : "Create invite"}
            </button>
          </form>

          {link && (
            <div className="mt-4 rounded-xl bg-[#FEF3C7] p-4 text-sm text-[#633806]">
              <p className="font-medium">Share this link with them. It works once and expires in 7 days.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-white/70 px-3 py-2 text-xs">{link}</code>
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs">Email is not sent automatically yet. The link is only shown once.</p>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-[#D9DCF5] bg-white p-6">
        <h2 className="text-lg font-semibold">Team ({members.length})</h2>
        {loading ? (
          <p className="mt-4 text-sm text-[#14142B]/50">Loading...</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#D9DCF5]">
            {members.map((m) => {
              const self = m.user_id === me.id;
              const initials = (m.name ?? m.email).slice(0, 2).toUpperCase();
              return (
                <li key={m.user_id} className="flex items-center gap-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF0FF] text-xs font-semibold text-[#4F46E5]">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.name ?? m.email}
                      {self && <span className="ml-2 rounded-full bg-[#EEF0FF] px-2 py-0.5 text-xs text-[#4F46E5]">You</span>}
                    </p>
                    <p className="truncate text-xs text-[#14142B]/45">{m.email}</p>
                  </div>

                  {isAdmin ? (
                    <select
                      value={m.role}
                      onChange={(e) => onRole(m, e.target.value as "admin" | "member")}
                      className="h-9 rounded-lg border border-[#14142B]/10 bg-white px-2 text-sm"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="rounded-full bg-[#EEF0FF] px-3 py-1 text-xs font-medium text-[#4F46E5]">{m.role}</span>
                  )}

                  {(isAdmin || self) && (
                    <button
                      onClick={() => onRemove(m)}
                      aria-label={self ? "Leave workspace" : `Remove ${m.email}`}
                      className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-[#14142B]/50 transition hover:bg-[#FEE2E2] hover:text-[#991B1B]"
                    >
                      <Trash2 size={16} />
                      {self ? "Leave" : ""}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isAdmin && invites.length > 0 && (
        <section className="rounded-2xl border border-[#D9DCF5] bg-white p-6">
          <h2 className="text-lg font-semibold">Pending invites</h2>
          <ul className="mt-3 divide-y divide-[#D9DCF5]">
            {invites.map((i) => (
              <li key={i.email} className="flex items-center justify-between py-3 text-sm">
                <span>{i.email}</span>
                <span className="text-xs text-[#14142B]/50">
                  {i.role}, expires {new Date(i.expires_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
