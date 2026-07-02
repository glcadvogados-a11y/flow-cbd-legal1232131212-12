import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
});

function Index() {
  const { loggedIn, hasAccount } = useAuth();
  if (!loggedIn || !hasAccount) return <Navigate to="/auth" />;
  return <Navigate to="/dashboard" />;
}
