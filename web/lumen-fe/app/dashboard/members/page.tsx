
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
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

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

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
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);

      const [memberList, inviteList] = await Promise.all([
        listMembers(workspace.id),
        isAdmin
          ? listInvites(workspace.id)
          : Promise.resolve([] as Invite[]),
      ]);

      setMembers(memberList);
      setInvites(inviteList);
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, [workspace.id, isAdmin]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setLink(null);

    try {
      const inv = await createInvite(workspace.id, email.trim(), role);

      setLink(
        `${window.location.origin}/accept-invite?token=${inv.invite_token}`
      );
      setEmail("");
      await load();
    } catch (err) {
      setError(msg(err));
    } finally {
      setSending(false);
    }
  };

  const onRole = async (
    m: Member,
    next: "admin" | "member"
  ) => {
    if (m.role === next) return;

    setBusyUser(m.user_id);
    setError(null);

    try {
      await changeRole(workspace.id, m.user_id, next);
      await load();
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusyUser(null);
    }
  };

  const onRemove = async (m: Member) => {
    const self = m.user_id === me.id;

    const confirmed = window.confirm(
      self
        ? "Leave this workspace? You may lose access to its documents."
        : `Remove ${m.name ?? m.email} from this workspace?`
    );

    if (!confirmed) return;

    setBusyUser(m.user_id);
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
    } finally {
      setBusyUser(null);
    }
  };

  const copy = async () => {
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy the invitation link. Please copy it manually.");
    }
  };

  const getInitials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  const avatarColors = [
    "bg-[#E9E7FF] text-[#5145CD]",
    "bg-[#DDF4EA] text-[#187D5D]",
    "bg-[#FCEAD9] text-[#A45D24]",
    "bg-[#E2EFFD] text-[#356BA6]",
    "bg-[#F6E4F1] text-[#9D4F85]",
  ];

  return (
    <main className="mx-auto w-full max-w-[1100px] space-y-8 pb-10 text-[#202139]">
      {/* Header */}
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#777791]">
            <Users size={14} />
            Workspace settings
          </div>

          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-[#202139] sm:text-[38px]">
            People & access
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-[#777791] sm:text-base">
            Manage who can access{" "}
            <span className="font-semibold text-[#393852]">
              {workspace.name}
            </span>{" "}
            and collaborate on its knowledge base.
          </p>
        </div>

        <div className="flex w-fit items-center gap-2 rounded-xl border border-[#E9E7F2] bg-white px-3.5 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0EEFF] text-[#5145CD]">
            <Users size={16} />
          </div>
          <div>
            <p className="text-lg font-semibold leading-5">
              {loading ? "—" : members.length}
            </p>
            <p className="mt-0.5 text-[11px] text-[#9291A7]">
              Workspace members
            </p>
          </div>
        </div>
      </header>

      {/* Errors */}
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="shrink-0 rounded-md p-1 hover:bg-red-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Invitation section */}
      {isAdmin && (
        <section className="overflow-hidden rounded-2xl border border-[#E2DDF8] bg-white">
          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            <div className="relative overflow-hidden bg-[#F3F0FF] p-6 sm:p-8">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#DCD5FF]/60 blur-2xl" />

              <div className="relative flex h-11 w-11 items-center justify-center rounded-[14px] bg-white text-[#5145CD] shadow-sm ring-1 ring-[#E7E1FF]">
                <UserPlus size={21} />
              </div>

              <h2 className="relative mt-5 text-xl font-semibold tracking-tight text-[#282541]">
                Bring your team together.
              </h2>

              <p className="relative mt-2 max-w-sm text-sm leading-6 text-[#777291]">
                Invite people to collaborate on documents, share knowledge,
                and build a workspace everyone can use.
              </p>

              <div className="relative mt-6 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E3DDFB] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#6257B0]">
                  <ShieldCheck size={13} />
                  Role-based access
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E3DDFB] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#6257B0]">
                  <Users size={13} />
                  Shared workspace
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="mb-5">
                <h3 className="text-base font-semibold text-[#292842]">
                  Invite a teammate
                </h3>
                <p className="mt-1 text-sm text-[#9291A7]">
                  Create a secure invitation link for a new member.
                </p>
              </div>

              <form onSubmit={onInvite} className="space-y-4">
                <div>
                  <label
                    htmlFor="invite-email"
                    className="mb-2 block text-xs font-semibold text-[#55546E]"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      size={17}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3A1B7]"
                    />
                    <input
                      id="invite-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="h-12 w-full rounded-xl border border-[#E5E3EF] bg-[#FCFBFE] pl-10 pr-3 text-sm text-[#292842] outline-none transition placeholder:text-[#B0AEC0] focus:border-[#8275E8] focus:bg-white focus:ring-4 focus:ring-[#5145CD]/10"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="invite-role"
                    className="mb-2 block text-xs font-semibold text-[#55546E]"
                  >
                    Access level
                  </label>
                  <select
                    id="invite-role"
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as "member" | "admin")
                    }
                    className="h-12 w-full rounded-xl border border-[#E5E3EF] bg-white px-3.5 text-sm text-[#393852] outline-none transition focus:border-[#8275E8] focus:ring-4 focus:ring-[#5145CD]/10"
                  >
                    <option value="member">Member — collaborate on documents</option>
                    <option value="admin">Admin — manage workspace access</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={sending || !email.trim()}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5145CD] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4035B5] focus:outline-none focus:ring-2 focus:ring-[#5145CD]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? (
                    "Creating invitation..."
                  ) : (
                    <>
                      Create invitation
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              {link && (
                <div
                  role="status"
                  className="mt-5 rounded-xl border border-[#D7EDE1] bg-[#F0FAF4] p-4"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#16805D]">
                      <CheckCircle2 size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#176747]">
                        Invitation created
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#53846E]">
                        Share this link with your teammate. It expires in 7
                        days and can be used once.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <input
                      aria-label="Invitation link"
                      readOnly
                      value={link}
                      onFocus={(e) => e.currentTarget.select()}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-[#D7EDE1] bg-white px-3 text-xs text-[#47735D] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void copy()}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#176747] px-3 text-xs font-semibold text-white transition hover:bg-[#10563A]"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-[#53846E]">
                    Email is not sent automatically. Share this link yourself.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Members list */}
      <section className="overflow-hidden rounded-2xl border border-[#E9E7F2] bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-[#F0EEF6] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[#292842]">
              Your team
            </h2>
            <p className="mt-1 text-sm text-[#9291A7]">
              People who can access this workspace.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#F5F3FB] px-3 py-1.5 text-xs font-medium text-[#777291]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5145CD]" />
            {loading ? "Loading members" : `${members.length} people`}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 p-6">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex animate-pulse items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-[#F0EFF7]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-36 rounded bg-[#F0EFF7]" />
                  <div className="h-3 w-48 max-w-full rounded bg-[#F5F4F9]" />
                </div>
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EEFF] text-[#5145CD]">
              <Users size={24} />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-[#292842]">
              No members found
            </h3>
            <p className="mt-1 text-sm text-[#9291A7]">
              Workspace members will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#F0EEF6]">
            {members.map((m, index) => {
              const self = m.user_id === me.id;
              const displayName = m.name ?? m.email;
              const initials = getInitials(displayName) || "?";
              const isBusy = busyUser === m.user_id;

              return (
                <li
                  key={m.user_id}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-[#FCFBFE] sm:flex-row sm:items-center sm:gap-4 sm:px-6"
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      avatarColors[index % avatarColors.length]
                    }`}
                  >
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[#33324D]">
                        {displayName}
                      </p>
                      {self && (
                        <span className="rounded-full bg-[#F0EEFF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5145CD]">
                          You
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-[#9291A7]">
                      {m.email}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:justify-end">
                    {isAdmin ? (
                      <label className="flex items-center gap-2">
                        <span className="sr-only">
                          Role for {m.email}
                        </span>
                        <select
                          value={m.role}
                          disabled={isBusy}
                          onChange={(e) =>
                            void onRole(
                              m,
                              e.target.value as "admin" | "member"
                            )
                          }
                          className="h-9 min-w-28 rounded-lg border border-[#E5E3EF] bg-white px-2.5 text-xs font-medium text-[#55546E] outline-none transition hover:border-[#CFC9F0] focus:border-[#8275E8] focus:ring-2 focus:ring-[#5145CD]/10 disabled:opacity-50"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F1FA] px-3 py-1.5 text-xs font-medium capitalize text-[#777291]">
                        {m.role === "admin" && <Crown size={12} />}
                        {m.role}
                      </span>
                    )}

                    {(isAdmin || self) && (
                      <button
                        type="button"
                        onClick={() => void onRemove(m)}
                        disabled={isBusy}
                        aria-label={
                          self ? "Leave workspace" : `Remove ${m.email}`
                        }
                        title={self ? "Leave workspace" : "Remove member"}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#9291A7] transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                        <span>{self ? "Leave" : "Remove"}</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Pending invitations */}
      {isAdmin && (
        <section className="overflow-hidden rounded-2xl border border-[#E9E7F2] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#F0EEF6] px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[#292842]">
                Pending invitations
              </h2>
              <p className="mt-1 text-sm text-[#9291A7]">
                Invitations that have not yet been accepted.
              </p>
            </div>

            <span className="rounded-full bg-[#FFF0D6] px-3 py-1 text-xs font-semibold text-[#986018]">
              {invites.length} pending
            </span>
          </div>

          {loading ? (
            <p className="px-6 py-5 text-sm text-[#9291A7]">
              Loading invitations...
            </p>
          ) : invites.length === 0 ? (
            <div className="flex items-start gap-3 px-5 py-6 sm:px-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5F3FB] text-[#8580A6]">
                <Mail size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-[#55546E]">
                  No pending invitations
                </p>
                <p className="mt-1 text-xs leading-5 text-[#9291A7]">
                  New invitations you create will appear here.
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-[#F0EEF6]">
              {invites.map((invite) => (
                <li
                  key={invite.email}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F0EEFF] text-[#5145CD]">
                      <Mail size={17} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#33324D]">
                        {invite.email}
                      </p>
                      <p className="mt-1 text-xs text-[#9291A7]">
                        Expires{" "}
                        {new Date(invite.expires_at).toLocaleDateString(
                          undefined,
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-13 sm:pl-0">
                    <span className="rounded-full bg-[#F3F1FA] px-3 py-1.5 text-xs font-medium capitalize text-[#777291]">
                      {invite.role}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#A19FB2]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#D89A35]" />
                      Awaiting acceptance
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <footer className="flex items-start gap-2 border-t border-[#E9E7F2] pt-5 text-xs leading-5 text-[#9291A7]">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#7771BB]" />
        <p>
          Access is managed per workspace. Only workspace admins can invite
          people or change member roles.
        </p>
      </footer>
    </main>
  );
}
