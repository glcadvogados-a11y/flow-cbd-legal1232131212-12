import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Package,
  MapPin,
  Download,
  Upload,
  Scale,
  Truck,
  LogOut,
  CloudUpload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportAll, importAll, importFromLocalStorage } from "@/lib/db";
import { logout, useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useRef, useState } from "react";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pacientes", url: "/pacientes", icon: Users },
  { title: "Processos", url: "/processos", icon: Scale },
  { title: "Fornecimentos", url: "/fornecimentos", icon: Truck },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Marcas", url: "/marcas", icon: Package },
  { title: "Estados", url: "/estados", icon: MapPin },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const json = await exportAll();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cbd-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exportado");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      await importAll(text);
      toast.success("Backup importado com sucesso");
    } catch {
      toast.error("Arquivo inválido");
    } finally {
      setBusy(false);
    }
  };

  const doImportLocal = async () => {
    if (
      !window.confirm(
        "Enviar os dados salvos neste navegador para a nuvem? Registros com o mesmo ID serão sobrescritos.",
      )
    )
      return;
    setBusy(true);
    try {
      const { total } = await importFromLocalStorage();
      if (total === 0) toast.info("Nada encontrado no navegador.");
      else toast.success(`${total} registros enviados para a nuvem`);
    } catch {
      toast.error("Falha ao importar do navegador");
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    await logout();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="border-b p-4">
        <h1 className="text-lg font-semibold">Gestão CBD</h1>
        <p className="text-xs text-muted-foreground">Judicialização</p>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {items.map((item) => {
          const active =
            item.url === "/dashboard"
              ? pathname === "/dashboard" || pathname === "/"
              : pathname.startsWith(item.url);
          return (
            <Link
              key={item.url}
              to={item.url}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/50"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t p-2">
        {user?.email && (
          <p className="truncate px-2 pb-1 text-[11px] text-muted-foreground">
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={doImportLocal}
          disabled={busy}
        >
          <CloudUpload className="mr-2 h-4 w-4" /> Enviar dados do navegador
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={doExport}
          disabled={busy}
        >
          <Download className="mr-2 h-4 w-4" /> Exportar backup
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Upload className="mr-2 h-4 w-4" /> Importar backup
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={doLogout}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </aside>
  );
}
