import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
});

function Index() {
  return <Navigate to="/dashboard" />;
}
