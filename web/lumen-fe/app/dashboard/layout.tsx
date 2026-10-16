
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Users,
  X,
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
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    ready: true,
  },
  {
    label: "Documents",
    href: "/dashboard/documents",
    icon: FileText,
    ready: true,
  },
  {
    label: "Chat",
    href: "/dashboard/chat",
    icon: MessageSquare,
    ready: false,
  },
  {
    label: "Members",
    href: "/dashboard/members",
    icon: Users,
    ready: true,
  },
];

const BOTTOM_NAV = [
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    ready: false,
  },
];

// Retry once with a refreshed access token if necessary.
async function loadMe(): Promise<Me> {
  const access = getAccessToken();

  if (access) {
    try {
      return await getMe(access);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) {
        throw e;
      }
    }
  }

  const refresh = getRefreshToken();

  if (!refresh) {
    throw new ApiError("Not signed in", 401);
  }

  const tokens = await refreshTokens(refresh);
  saveTokens(tokens);

  return getMe(tokens.access_token);
}

// Prevent duplicate refresh requests in React development mode.
let pending: Promise<Me> | null = null;

function loadMeOnce() {
  if (!pending) {
    pending = loadMe().finally(() => {
      pending = null;
    });
  }

  return pending;
}

function getInitials(value: string) {
  return value
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function NavItem({
  item,
  active,
  onNavigate,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  if (!item.ready) {
    return (
      <div
        title={`${item.label} is coming soon`}
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-[#A4A2B3]"
      >
        <Icon size={17} strokeWidth={1.8} />
        <span className="flex-1">{item.label}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-[#A4A2B3]">
          Soon
        </span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5",
        "text-[13px] font-medium transition-colors duration-150",
        active
          ? "bg-[#F0EEFF] text-[#5145CD]"
          : "text-[#68677E] hover:bg-[#F7F6FB] hover:text-[#292842]",
      ].join(" ")}
    >
      {active && (
        <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[#5145CD]" />
      )}

      <Icon
        size={17}
        strokeWidth={active ? 2.1 : 1.8}
        className={
          active
            ? "text-[#5145CD]"
            : "text-[#9291A7] group-hover:text-[#5145CD]"
        }
      />

      <span className="flex-1">{item.label}</span>

      {active && (
        <ChevronRight size={14} className="text-[#8176D9]" />
      )}
    </Link>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [me, setMe] = useState<Me | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadMeOnce()
      .then((data) => {
        if (cancelled) return;

        setMe(data);

        const saved = localStorage.getItem("workspace_id");
        const match =
          data.workspaces.find((w) => w.id === saved) ??
          data.workspaces[0];

        setWorkspaceId(match?.id ?? null);

        if (!match) {
          setError("No workspace is available for this account.");
        }
      })
      .catch((err) => {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 401) {
          clearTokens();
          router.replace("/");
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    const refresh = getRefreshToken();

    try {
      if (refresh) {
        await logout(refresh).catch(() => {});
      }
    } finally {
      clearTokens();
      router.replace("/");
    }
  };

  const selectWorkspace = (id: string) => {
    setWorkspaceId(id);
    localStorage.setItem("workspace_id", id);
  };

  const handleCreated = (ws: Me["workspaces"][number]) => {
    setMe((current) =>
      current
        ? {
            ...current,
            workspaces: [...current.workspaces, ws],
          }
        : current
    );

    selectWorkspace(ws.id);
  };

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F7FC] px-6 text-[#292842]">
        <div className="w-full max-w-md rounded-2xl border border-[#E9E6F2] bg-white p-8 shadow-sm">
          <div className="mb-5">
            <Logo />
          </div>

          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FDECEC] text-[#B42335]">
            <X size={20} />
          </div>

          <h1 className="text-xl font-semibold tracking-tight">
            Unable to open your workspace
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#77768B]">
            {error}
          </p>

          <button
            onClick={() => window.location.reload()}
            className="mt-6 h-11 w-full rounded-xl bg-[#5145CD] px-4 text-sm font-semibold text-white transition hover:bg-[#4035B5]"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const workspace = me?.workspaces.find(
    (w) => w.id === workspaceId
  );

  if (!me || !workspace) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8F7FC]">
        <Logo />
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E2DFFA] border-t-[#5145CD]" />
        <p className="text-sm text-[#9291A7]">
          Preparing your workspace...
        </p>
      </main>
    );
  }

  const displayName = me.name ?? me.email;
  const initials = getInitials(displayName);

  const pageTitle =
    [...NAV, ...BOTTOM_NAV].find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/dashboard" &&
          pathname.startsWith(`${item.href}/`))
    )?.label ?? "Workspace";

  return (
    <MeContext.Provider value={{ me, workspace }}>
      <div className="min-h-screen bg-[#F8F7FC] text-[#292842] lg:flex">

        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col border-r border-[#EAE8F1] bg-white lg:flex">
          {/* Brand */}
          <div className="flex h-[76px] items-center border-b border-[#F0EEF5] px-6">
            <Logo />
          </div>

          {/* Workspace */}
          <div className="px-4 pb-5 pt-5">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#A09FB1]">
              Your workspace
            </p>

            <WorkspaceMenu
              workspaces={me.workspaces}
              currentId={workspace.id}
              onSelect={selectWorkspace}
              onCreated={handleCreated}
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#A09FB1]">
              Workspace
            </p>

            <div className="space-y-1">
              {NAV.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  active={
                    item.href === "/dashboard"
                      ? pathname === item.href
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`)
                  }
                />
              ))}
            </div>

            <div className="mb-3 mt-8 border-t border-[#F0EEF5]" />

            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#A09FB1]">
              Preferences
            </p>

            <div className="space-y-1">
              {BOTTOM_NAV.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                />
              ))}
            </div>

            {/* Product context */}
            <div className="mt-8 rounded-xl border border-[#EBE8F8] bg-[#FAF9FF] p-3.5">
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-[#5145CD]" />
                <span className="text-xs font-semibold text-[#44425F]">
                  Your knowledge, connected.
                </span>
              </div>

              <p className="mt-2 text-[11px] leading-5 text-[#88869E]">
                Keep your team&apos;s documents in one searchable place.
              </p>
            </div>
          </nav>

          {/* User account */}
          <div className="border-t border-[#F0EEF5] p-4">
            <div className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-[#FAF9FD]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E9E6FF] text-xs font-semibold text-[#5145CD]">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#393750]">
                  {me.name ?? "Account"}
                </p>
                <p className="truncate text-[11px] text-[#9291A7]">
                  {me.email}
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label="Log out"
                title="Log out"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#9291A7] transition hover:bg-[#FDECEC] hover:text-[#B42335] disabled:opacity-50"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main application */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">

          {/* Top header */}
          <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-[#EAE8F1] bg-white/95 px-4 backdrop-blur-sm sm:px-6 lg:px-9">

            <div className="flex min-w-0 items-center gap-3">
              {/* Mobile menu */}
              <button
                type="button"
                onClick={() => setMobileNavOpen((open) => !open)}
                aria-label={
                  mobileNavOpen ? "Close navigation" : "Open navigation"
                }
                aria-expanded={mobileNavOpen}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#68677E] transition hover:bg-[#F3F1FA] lg:hidden"
              >
                {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-[#A09FB1]">
                  <span className="hidden sm:inline">Lumen Docs</span>
                  <ChevronRight
                    size={13}
                    className="hidden sm:inline"
                  />
                  <span className="truncate font-medium text-[#68677E]">
                    {pageTitle}
                  </span>
                </div>

                <p className="mt-0.5 max-w-[210px] truncate text-[12px] font-medium text-[#9291A7] sm:max-w-sm">
                  {workspace.name}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              {/* Mobile workspace selector */}
              <div className="min-w-0 max-w-[190px] lg:hidden">
                <WorkspaceMenu
                  workspaces={me.workspaces}
                  currentId={workspace.id}
                  onSelect={selectWorkspace}
                  onCreated={handleCreated}
                />
              </div>

              <div className="hidden h-8 w-px bg-[#EAE8F1] sm:block" />

              <div className="hidden min-w-0 sm:block">
                <p className="max-w-[150px] truncate text-xs font-semibold text-[#4A4862]">
                  {me.name ?? "Account"}
                </p>
                <p className="text-[10px] text-[#A09FB1]">
                  {workspace.role === "admin" ? "Workspace admin" : "Team member"}
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label="Log out"
                title="Log out"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#9291A7] transition hover:bg-[#FDECEC] hover:text-[#B42335] disabled:opacity-50 sm:hidden"
              >
                <LogOut size={17} />
              </button>

              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E9E6FF] text-xs font-semibold text-[#5145CD] sm:flex">
                {initials}
              </div>
            </div>
          </header>

          {/* Mobile navigation drawer */}
          {mobileNavOpen && (
            <div className="fixed inset-0 top-[68px] z-40 lg:hidden">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
                className="absolute inset-0 bg-[#292842]/20"
              />

              <nav className="relative flex h-full w-[min(300px,85vw)] flex-col border-r border-[#EAE8F1] bg-white p-4 shadow-xl">
                <div className="mb-5 border-b border-[#F0EEF5] pb-4">
                  <Logo />
                  <p className="mt-4 px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#A09FB1]">
                    Navigation
                  </p>
                </div>

                <div className="space-y-1">
                  {NAV.map((item) => (
                    <NavItem
                      key={item.href}
                      item={item}
                      active={
                        item.href === "/dashboard"
                          ? pathname === item.href
                          : pathname === item.href ||
                            pathname.startsWith(`${item.href}/`)
                      }
                      onNavigate={() => setMobileNavOpen(false)}
                    />
                  ))}
                </div>

                <div className="mb-3 mt-7 border-t border-[#F0EEF5]" />

                {BOTTOM_NAV.map((item) => (
                  <NavItem
                    key={item.href}
                    item={item}
                    active={pathname === item.href}
                  />
                ))}

                <div className="mt-auto border-t border-[#F0EEF5] pt-4">
                  <div className="flex items-center gap-3 px-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E9E6FF] text-xs font-semibold text-[#5145CD]">
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {me.name ?? "Account"}
                      </p>
                      <p className="truncate text-xs text-[#9291A7]">
                        {me.email}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="mt-4 flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-[#77768B] transition hover:bg-[#FDECEC] hover:text-[#B42335] disabled:opacity-50"
                  >
                    <LogOut size={16} />
                    Sign out
                    <ArrowUpRight size={14} className="ml-auto" />
                  </button>
                </div>
              </nav>
            </div>
          )}

          {/* Page content */}
          <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-9 lg:py-9">
            <div className="mx-auto w-full max-w-[1440px]">
              {children}
            </div>
          </main>

          {/* Quiet footer */}
          <footer className="border-t border-[#EAE8F1] bg-white/70 px-6 py-3.5 lg:px-9">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
              <p className="text-[10px] text-[#A09FB1]">
                Lumen Docs
                <span className="mx-2 text-[#D2CFDF]">/</span>
                Your team&apos;s knowledge workspace
              </p>

              <span className="flex items-center gap-1.5 text-[10px] text-[#9291A7]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#36A681]" />
                Workspace active
              </span>
            </div>
          </footer>
        </div>
      </div>
    </MeContext.Provider>
  );
}