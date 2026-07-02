import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  authApi,
  setAccessToken,
  setOnUnauthorized,
  workspaceApi,
  type LoginInput,
  type RegisterInput,
  type User,
  type WorkspaceSummary,
} from "@/lib/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

const CURRENT_WS_KEY = "socialhub.currentWorkspaceId";

interface AppData {
  user: User | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;

  workspaces: WorkspaceSummary[];
  currentWorkspace: WorkspaceSummary | null;
  workspacesLoading: boolean;
  selectWorkspace: (id: string) => void;
  createWorkspace: (name: string) => Promise<WorkspaceSummary | null>;
  refreshWorkspaces: () => Promise<void>;
}

const AppContext = createContext<AppData | null>(null);

function readStoredWorkspaceId(): string | null {
  try {
    return localStorage.getItem(CURRENT_WS_KEY);
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(readStoredWorkspaceId);

  const refreshWorkspaces = useCallback(async () => {
    const { workspaces: list } = await workspaceApi.list();
    setWorkspaces(list);
  }, []);

  const loadWorkspaces = useCallback(async () => {
    setWorkspacesLoading(true);
    try {
      await refreshWorkspaces();
    } finally {
      setWorkspacesLoading(false);
    }
  }, [refreshWorkspaces]);

  const resetSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setWorkspaces([]);
    setWorkspacesLoading(false);
    setStatus("unauthenticated");
  }, []);

  // If a token refresh ultimately fails mid-session, drop to signed-out.
  useEffect(() => {
    setOnUnauthorized(() => resetSession());
    return () => setOnUnauthorized(null);
  }, [resetSession]);

  // On first load, try a silent refresh so a returning user stays signed in.
  // A didInit guard ensures this fires exactly once, even under React StrictMode
  // (a double-invoke would race two refreshes and could spuriously sign the user out).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    authApi
      .refresh()
      .then(async (res) => {
        setAccessToken(res.accessToken);
        setUser(res.user);
        setStatus("authenticated");
        await loadWorkspaces();
      })
      .catch(() => {
        setAccessToken(null);
        setStatus("unauthenticated");
        setWorkspacesLoading(false);
      });
  }, [loadWorkspaces]);

  const enterSession = useCallback(
    async (accessToken: string, u: User) => {
      setAccessToken(accessToken);
      setUser(u);
      setStatus("authenticated");
      await loadWorkspaces();
    },
    [loadWorkspaces]
  );

  const login = useCallback(
    async (input: LoginInput) => {
      const res = await authApi.login(input);
      await enterSession(res.accessToken, res.user);
    },
    [enterSession]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await authApi.register(input);
      await enterSession(res.accessToken, res.user);
    },
    [enterSession]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      resetSession();
    }
  }, [resetSession]);

  const selectWorkspace = useCallback((id: string) => {
    setCurrentWorkspaceId(id);
    try {
      localStorage.setItem(CURRENT_WS_KEY, id);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const createWorkspace = useCallback(
    async (name: string) => {
      const { workspace } = await workspaceApi.create(name);
      await refreshWorkspaces();
      selectWorkspace(workspace.id);
      return {
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
        role: "OWNER" as const,
        createdAt: workspace.createdAt,
      };
    },
    [refreshWorkspaces, selectWorkspace]
  );

  const currentWorkspace =
    workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0] ?? null;

  return (
    <AppContext.Provider
      value={{
        user,
        status,
        login,
        register,
        logout,
        workspaces,
        currentWorkspace,
        workspacesLoading,
        selectWorkspace,
        createWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData(): AppData {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppData must be used within an AppProvider");
  return ctx;
}
