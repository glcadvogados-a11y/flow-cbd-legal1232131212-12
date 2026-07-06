import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { loggedIn, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !loggedIn) navigate({ to: "/auth", replace: true });
  }, [ready, loggedIn, navigate]);

  if (!ready || !loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
