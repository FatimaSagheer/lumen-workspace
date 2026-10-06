const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Tokens = { access_token: string; refresh_token: string };

export type Me = {
  id: string;
  email: string;
  name: string | null;
  workspaces: { id: string; name: string; role: string }[];
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError("Cannot reach the server. Is the API running?", 0);
  }

  if (!res.ok) {
    let message = "Something went wrong";
    try {
      const data = await res.json();
      if (typeof data.detail === "string") message = data.detail;
      else if (Array.isArray(data.detail))
        message = data.detail.map((d: { msg: string }) => d.msg).join(", ");
    } catch {}
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const saveTokens = (t: Tokens) => {
  localStorage.setItem("access_token", t.access_token);
  localStorage.setItem("refresh_token", t.refresh_token);
};
export const clearTokens = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
};
export const getAccessToken = () => localStorage.getItem("access_token");
export const getRefreshToken = () => localStorage.getItem("refresh_token");

export const login = (email: string, password: string) =>
  request<Tokens>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const signup = (email: string, password: string, name?: string) =>
  request<Tokens>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });

export const logout = (refresh_token: string) =>
  request<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refresh_token }),
  });

export const getMe = (token: string) =>
  request<Me>("/auth/me", { headers: { Authorization: `Bearer ${token}` } });

export const refreshTokens = (refresh_token: string) =>
  request<Tokens>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token }),
  });

// ---- Authenticated calls (retry once after a token refresh) ----
let refreshing: Promise<Tokens> | null = null;

async function authed<T>(path: string, options: RequestInit = {}): Promise<T> {
  const call = () =>
    request<T>(path, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${getAccessToken() ?? ""}` },
    });
  try {
    return await call();
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    const rt = getRefreshToken();
    if (!rt) throw e;
    refreshing ??= refreshTokens(rt).finally(() => {
      refreshing = null;
    });
    saveTokens(await refreshing);
    return call();
  }
}

export type Member = {
  user_id: string;
  email: string;
  name: string | null;
  role: "admin" | "member";
};
export type Invite = {
  email: string;
  role: string;
  expires_at: string;
  invite_token?: string | null;
};
export type WorkspaceInfo = { id: string; name: string; role: string };

export const listMembers = (ws: string) => authed<Member[]>(`/workspaces/${ws}/members`);
export const listInvites = (ws: string) => authed<Invite[]>(`/workspaces/${ws}/invites`);
export const createInvite = (ws: string, email: string, role: string) =>
  authed<Invite>(`/workspaces/${ws}/invites`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
export const changeRole = (ws: string, userId: string, role: string) =>
  authed<{ user_id: string; role: string }>(`/workspaces/${ws}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
export const removeMember = (ws: string, userId: string) =>
  authed<void>(`/workspaces/${ws}/members/${userId}`, { method: "DELETE" });
export const acceptInvite = (token: string) =>
  authed<WorkspaceInfo>("/invites/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
export const createWorkspace = (name: string) =>
  authed<WorkspaceInfo>("/workspaces", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
