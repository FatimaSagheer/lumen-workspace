"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import Logo from "@/components/logo";
import WorkspaceMenu from "@/components/WorkspaceMenu";
import { MeContext } from "@/lib/me-context";
import {
  ApiError,
  clearTokens,
  getAccessToken,
  getMe,
  getRefreshToken,
  logout,
  refreshTokens,
  saveTokens,
  type Me,
} from "@/lib/api";

const NAV = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, ready: true },
  { label: "Members", href: "/dashboard/members", icon: Users, ready: true },
  { label: "Documents", href: "/dashboard/documents", icon: FileText, ready: false },
  { label: "Chat", href: "/dashboard/chat", icon: MessageSquare, ready: false },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, ready: false },
];

// Try the access token; if it expired, rotate the refresh token once and retry.
async function loadMe(): Promise<Me> {
  const access = getAccessToken();
  if (access) {
    try {
      return await getMe(access);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
    }
  }
  const refresh = getRefreshToken();
  if (!refresh) throw new ApiError("Not signed in", 401);
  const tokens = await refreshTokens(refresh);
  saveTokens(tokens);
  return getMe(tokens.access_token);
}

// Refresh tokens work once. React dev mode runs effects twice, so share one request.
let pending: Promise<Me> | null = null;
function loadMeOnce() {
  if (!pending) pending = loadMe().finally(() => (pending = null));
  return pending;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMeOnce()
      .then((data) => {
        setMe(data);
        const saved = localStorage.getItem("workspace_id");
        const match = data.workspaces.find((w) => w.id === saved) ?? data.workspaces[0];
        setWorkspaceId(match?.id ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearTokens();
          router.replace("/");
        } else {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      });
  }, [router]);

  const handleLogout = async () => {
    const refresh = getRefreshToken();
    if (refresh) await logout(refresh).catch(() => {});
    clearTokens();
    router.replace("/");
  };

  const selectWorkspace = (id: string) => {
    setWorkspaceId(id);
    localStorage.setItem("workspace_id", id);
  };

  const handleCreated = (ws: { id: string; name: string; role: string }) => {
    setMe((m) => (m ? { ...m, workspaces: [...m.workspaces, ws] } : m));
    selectWorkspace(ws.id);
  };

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#EEF0FF] text-[#14142B]">
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-[#4F46E5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4338CA]"
        >
          Try again
        </button>
      </main>
    );
  }

  const workspace = me?.workspaces.find((w) => w.id === workspaceId);

  if (!me || !workspace) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EEF0FF] text-[#14142B]/60">
        Loading...
      </main>
    );
  }

  const initials = (me.name ?? me.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  return (
    <MeContext.Provider value={{ me, workspace }}>
      <div className="flex min-h-screen bg-[#F6F7FF] text-[#14142B]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[#D9DCF5] bg-white p-5 lg:flex">
          <Logo />

          <nav className="mt-10 space-y-1">
            {NAV.map(({ label, href, icon: Icon, ready }) => {
              const active = pathname === href;
              if (!ready) {
                return (
                  <div
                    key={label}
                    className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#14142B]/35"
                  >
                    <Icon size={19} />
                    {label}
                    <span className="ml-auto rounded-full bg-[#EEF0FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#4F46E5]/70">
                      Soon
                    </span>
                  </div>
                );
              }
              return (
                <Link
                  key={label}
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-[#EEF0FF] text-[#4F46E5]"
                      : "text-[#14142B]/70 hover:bg-[#EEF0FF]/60"
                  }`}
                >
                  <Icon size={19} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex items-center gap-3 rounded-xl border border-[#D9DCF5] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{me.name ?? "Account"}</p>
              <p className="truncate text-xs text-[#14142B]/50">{me.email}</p>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="rounded-lg p-2 text-[#14142B]/45 transition hover:bg-[#EEF0FF] hover:text-[#14142B]"
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-[#D9DCF5] bg-white px-6 py-3">
            <div className="lg:hidden">
              <Logo size={32} />
            </div>

            <WorkspaceMenu
              workspaces={me.workspaces}
              currentId={workspace.id}
              onSelect={selectWorkspace}
              onCreated={handleCreated}
            />

            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="rounded-lg p-2 text-[#14142B]/45 hover:bg-[#EEF0FF] lg:hidden"
            >
              <LogOut size={18} />
            </button>
          </header>

          <main className="flex-1 p-6 lg:p-10">{children}</main>
        </div>
      </div>
    </MeContext.Provider>
  );
}
