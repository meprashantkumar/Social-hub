import { Navigate, Outlet, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoader } from "@/components/shared/FullScreenLoader";
import { Onboarding } from "@/pages/onboarding/Onboarding";
import { useAppData } from "@/context/AppContext";

/** Only renders children for signed-in users; otherwise sends them to /login. */
export function ProtectedRoute() {
  const { status } = useAppData();
  if (status === "loading") return <FullScreenLoader />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** For /login and /register: bounce already-signed-in users to their destination. */
export function PublicOnlyRoute() {
  const { status } = useAppData();
  const [params] = useSearchParams();
  if (status === "loading") return <FullScreenLoader />;
  if (status === "authenticated") {
    const next = params.get("next");
    const dest = next && next.startsWith("/") ? next : "/dashboard";
    return <Navigate to={dest} replace />;
  }
  return <Outlet />;
}

/** Ensures the signed-in user has a workspace; otherwise shows onboarding. */
export function WorkspaceGate() {
  const { workspacesLoading, workspaces } = useAppData();
  if (workspacesLoading) return <FullScreenLoader />;
  if (workspaces.length === 0) return <Onboarding />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
