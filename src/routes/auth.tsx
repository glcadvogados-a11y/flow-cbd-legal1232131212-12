import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getAuthRecord, login, registerUser, resetAccount, useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { loggedIn } = useAuth();
  const hasAccount = !!getAuthRecord();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  if (loggedIn) {
    navigate({ to: "/dashboard" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!hasAccount) {
        if (password.length < 4) {
          toast.error("Senha muito curta");
          return;
        }
        if (password !== confirm) {
          toast.error("Senhas não conferem");
          return;
        }
        await registerUser(username, password);
        toast.success("Conta criada");
        navigate({ to: "/dashboard" });
      } else {
        const ok = await login(username, password);
        if (ok) navigate({ to: "/dashboard" });
        else toast.error("Usuário ou senha inválidos");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Gestão CBD</CardTitle>
          <CardDescription>
            {hasAccount ? "Entre com sua conta" : "Crie sua conta de acesso"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="u">Usuário</Label>
              <Input
                id="u"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p">Senha</Label>
              <Input
                id="p"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={hasAccount ? "current-password" : "new-password"}
              />
            </div>
            {!hasAccount && (
              <div className="space-y-2">
                <Label htmlFor="c">Confirmar senha</Label>
                <Input
                  id="c"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {hasAccount ? "Entrar" : "Criar conta"}
            </Button>
          </form>
          {hasAccount && (
            <div className="mt-4 text-center">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="link" size="sm" className="text-muted-foreground">
                    Esqueci minha senha / redefinir acesso
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Redefinir acesso local?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A conta é armazenada apenas neste navegador e não há como recuperar a senha.
                      Esta ação apaga somente as credenciais — os dados do sistema (pacientes,
                      processos, fornecimentos etc.) permanecem intactos. Depois você poderá criar
                      uma nova conta.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        resetAccount();
                        setUsername("");
                        setPassword("");
                        setConfirm("");
                        toast.success("Acesso redefinido. Crie uma nova conta.");
                      }}
                    >
                      Redefinir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
