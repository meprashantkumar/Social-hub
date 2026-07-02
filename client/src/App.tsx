import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute, WorkspaceGate } from "@/components/layout/RouteGuards";
import { Login } from "@/pages/auth/Login";
import { Register } from "@/pages/auth/Register";
import { AcceptInvite } from "@/pages/invite/AcceptInvite";
import { Analytics } from "@/pages/analytics/Analytics";
import { Connections } from "@/pages/connections/Connections";
import { Dashboard } from "@/pages/dashboard/Dashboard";
import { Members } from "@/pages/members/Members";
import { PostEditor } from "@/pages/posts/PostEditor";
import { PostsList } from "@/pages/posts/PostsList";

export default function App() {
  return (
    <Routes>
      {/* Public invite landing (works signed-in or signed-out) */}
      <Route path="/invite/:token" element={<AcceptInvite />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<WorkspaceGate />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/posts" element={<PostsList />} />
          <Route path="/posts/new" element={<PostEditor />} />
          <Route path="/posts/:id" element={<PostEditor />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/members" element={<Members />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
