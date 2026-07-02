import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Package,
  MapPin,
  LogOut,
  Download,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { exportAll, importAll } from "@/lib/db";
import { toast } from "sonner";
import { useRef } from "react";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Pacientes", url: "/pacientes", icon: Users },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Marcas", url: "/marcas", icon: Package },
  { title: "Estados", url: "/estados", icon: MapPin },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cbd-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exportado");
  };

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      importAll(text);
      toast.success("Backup importado com sucesso");
    } catch {
      toast.error("Arquivo inválido");
    }
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
            item.url === "/"
              ? pathname === "/"
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
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={doExport}
        >
          <Download className="mr-2 h-4 w-4" /> Exportar backup
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => fileRef.current?.click()}
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
          className="w-full justify-start"
          onClick={() => {
            logout();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </aside>
  );
}
