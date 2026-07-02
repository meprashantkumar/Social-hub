export type Role = "OWNER" | "EDITOR" | "REVIEWER" | "VIEWER";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  ownerId: string;
  role: Role;
  createdAt: string;
}

export interface MemberUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface Member {
  userId: string;
  role: Role;
  joinedAt: string;
  user: MemberUser;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  members: Member[];
}

export interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  role: Role;
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationPreview {
  role: Role;
  status: string;
  workspace: { id: string; name: string };
  expiresAt: string;
}

export type Platform = "YOUTUBE" | "INSTAGRAM" | "LINKEDIN" | "X";

export interface Connection {
  id: string;
  platform: Platform;
  platformAccountId: string;
  accountName: string;
  avatarUrl: string | null;
  scope: string | null;
  tokenExpiresAt: string | null;
  connectedById: string;
  connectedAt: string;
}

/** Error carrying the backend's HTTP status + machine-readable code. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const BASE = "/api";

// Access token lives in memory only. The long-lived refresh token is an httpOnly
// cookie the JS can't read.
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorized = cb;
}

interface Options {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function doFetch(path: string, { method, body, headers }: Options): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function parse<T>(res: Response): Promise<T> {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new ApiError(res.status, payload?.error ?? res.statusText ?? "Request failed", payload?.code);
  }
  return payload as T;
}

async function request<T>(path: string, opts: Options = {}, isRetry = false): Promise<T> {
  let res: Response;
  try {
    res = await doFetch(path, opts);
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the API running?", "NETWORK_ERROR");
  }

  // Transparently refresh an expired access token once, then retry.
  if (res.status === 401 && !isRetry && !path.startsWith("/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, opts, true);
  }

  return parse<T>(res);
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await doFetch("/auth/refresh", { method: "POST" });
    if (!res.ok) throw new Error("refresh failed");
    const data = (await res.json()) as AuthResponse;
    accessToken = data.accessToken;
    return true;
  } catch {
    accessToken = null;
    onUnauthorized?.();
    return false;
  }
}

export const authApi = {
  register: (data: RegisterInput) => request<AuthResponse>("/auth/register", { method: "POST", body: data }),
  login: (data: LoginInput) => request<AuthResponse>("/auth/login", { method: "POST", body: data }),
  refresh: () => request<AuthResponse>("/auth/refresh", { method: "POST" }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),
};

export const workspaceApi = {
  list: () => request<{ workspaces: WorkspaceSummary[] }>("/workspaces"),
  create: (name: string) => request<{ workspace: WorkspaceDetail }>("/workspaces", { method: "POST", body: { name } }),
  get: (id: string) => request<{ workspace: WorkspaceDetail }>(`/workspaces/${id}`),
  rename: (id: string, name: string) =>
    request<{ workspace: WorkspaceDetail }>(`/workspaces/${id}`, { method: "PATCH", body: { name } }),
  remove: (id: string) => request<void>(`/workspaces/${id}`, { method: "DELETE" }),
  invite: (id: string, email: string, role: Role) =>
    request<{ invitation: Invitation }>(`/workspaces/${id}/invite`, { method: "POST", body: { email, role } }),
  listInvitations: (id: string) =>
    request<{ invitations: Invitation[] }>(`/workspaces/${id}/invitations`),
  revokeInvitation: (id: string, invitationId: string) =>
    request<void>(`/workspaces/${id}/invitations/${invitationId}`, { method: "DELETE" }),
  changeRole: (id: string, userId: string, role: Role) =>
    request<{ member: Member }>(`/workspaces/${id}/members/${userId}`, { method: "PATCH", body: { role } }),
  removeMember: (id: string, userId: string) =>
    request<void>(`/workspaces/${id}/members/${userId}`, { method: "DELETE" }),
};

export const invitationApi = {
  preview: (token: string) => request<{ invitation: InvitationPreview }>(`/invitations/${token}`),
  accept: (token: string) => request<{ workspace: WorkspaceDetail }>(`/invitations/${token}/accept`, { method: "POST" }),
};

export type PostStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED";

export type Visibility = "private" | "unlisted" | "public";

export interface PostTargetView {
  id: string;
  connectionId: string;
  caption: string | null;
  publishStatus: PostStatus;
  publishedUrl: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  connection: { platform: Platform; accountName: string; avatarUrl: string | null } | null;
}

export interface PostDetail {
  id: string;
  workspaceId: string;
  title: string | null;
  mediaUrl: string | null;
  status: PostStatus;
  visibility: Visibility;
  scheduledFor: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  targets: PostTargetView[];
}

export interface PostSummary {
  id: string;
  title: string | null;
  mediaUrl: string | null;
  status: PostStatus;
  scheduledFor: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  targetCount: number;
  platforms: Platform[];
}

export interface PostTargetInput {
  connectionId: string;
  caption?: string;
}

export const postsApi = {
  list: (workspaceId: string, status?: string) =>
    request<{ posts: PostSummary[] }>(
      `/posts?workspaceId=${encodeURIComponent(workspaceId)}${status ? `&status=${status}` : ""}`
    ),
  get: (id: string) => request<{ post: PostDetail }>(`/posts/${id}`),
  create: (input: { workspaceId: string; title?: string; mediaUrl?: string; targets: PostTargetInput[] }) =>
    request<{ post: PostDetail }>("/posts", { method: "POST", body: input }),
  update: (
    id: string,
    input: { title?: string | null; mediaUrl?: string | null; targets?: PostTargetInput[] }
  ) => request<{ post: PostDetail }>(`/posts/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => request<void>(`/posts/${id}`, { method: "DELETE" }),
  submit: (id: string) => request<{ post: PostDetail }>(`/posts/${id}/submit`, { method: "POST" }),
  approve: (id: string) => request<{ post: PostDetail }>(`/posts/${id}/approve`, { method: "POST" }),
  requestChanges: (id: string) =>
    request<{ post: PostDetail }>(`/posts/${id}/request-changes`, { method: "POST" }),
  publish: (id: string, visibility: Visibility) =>
    request<{ post: PostDetail }>(`/posts/${id}/publish`, { method: "POST", body: { visibility } }),
  schedule: (id: string, scheduledFor: string, visibility: Visibility) =>
    request<{ post: PostDetail }>(`/posts/${id}/schedule`, {
      method: "POST",
      body: { scheduledFor, visibility },
    }),
  unschedule: (id: string) =>
    request<{ post: PostDetail }>(`/posts/${id}/unschedule`, { method: "POST" }),
};

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

export const mediaApi = {
  /** Get a signed payload to upload one file directly to Cloudinary. */
  signUpload: (workspaceId: string) =>
    request<UploadSignature>(`/media/sign?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "POST",
    }),
};

export const connectionsApi = {
  list: (workspaceId: string) =>
    request<{ connections: Connection[] }>(`/connections?workspaceId=${encodeURIComponent(workspaceId)}`),
  startOAuth: (platform: string, workspaceId: string) =>
    request<{ url: string }>(
      `/connections/oauth/${platform}/start?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  disconnect: (id: string) => request<void>(`/connections/${id}`, { method: "DELETE" }),
};

export interface TargetAnalytics {
  connectionId: string;
  platform: Platform;
  accountName: string;
  videoId: string | null;
  url: string | null;
  views: number;
  likes: number;
  comments: number;
  error: string | null;
}

export interface PostAnalytics {
  postId: string;
  title: string | null;
  publishedAt: string | null;
  targets: TargetAnalytics[];
}

export interface WorkspaceAnalytics {
  totals: { posts: number; views: number; likes: number; comments: number };
  posts: PostAnalytics[];
}

export const analyticsApi = {
  get: (workspaceId: string) =>
    request<WorkspaceAnalytics>(`/analytics?workspaceId=${encodeURIComponent(workspaceId)}`),
};
