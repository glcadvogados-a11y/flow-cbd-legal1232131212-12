import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCollection, uid, seedStatesIfEmpty, type State } from "@/lib/db";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/estados")({
  component: EstadosPage,
});

function EstadosPage() {
  const { items, upsert, remove } = useCollection("states");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<State | null>(null);

  useEffect(() => {
    seedStatesIfEmpty();
  }, []);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Estados</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre os estados e a periodicidade do fornecimento (em meses).
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo estado
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="p-4">Sigla</th>
                <th className="p-4">Nome</th>
                <th className="p-4">Periodicidade</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Nenhum estado cadastrado.
                  </td>
                </tr>
              )}
              {items.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="p-4 font-medium">{s.sigla}</td>
                  <td className="p-4">{s.nome}</td>
                  <td className="p-4">{s.mesesFornecimento} meses</td>
                  <td className="p-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(s);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Excluir estado ${s.sigla}?`)) {
                          remove(s.id);
                          toast.success("Estado excluído");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <StateForm
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSave={(s) => {
          upsert(s);
          toast.success(editing ? "Estado atualizado" : "Estado cadastrado");
        }}
      />
    </div>
  );
}

function StateForm({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: State | null;
  onSave: (s: State) => void;
}) {
  const [sigla, setSigla] = useState("");
  const [nome, setNome] = useState("");
  const [meses, setMeses] = useState<string>("12");

  useEffect(() => {
    if (editing) {
      setSigla(editing.sigla);
      setNome(editing.nome);
      setMeses(String(editing.mesesFornecimento));
    } else {
      setSigla("");
      setNome("");
      setMeses("12");
    }
  }, [editing, open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sigla.trim() || !nome.trim()) {
      toast.error("Preencha sigla e nome");
      return;
    }
    const m = parseInt(meses, 10);
    if (!m || m < 1) {
      toast.error("Informe a periodicidade em meses");
      return;
    }
    onSave({
      id: editing?.id ?? uid(),
      sigla: sigla.trim().toUpperCase(),
      nome: nome.trim(),
      mesesFornecimento: m,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar estado" : "Novo estado"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sigla</Label>
              <Input
                value={sigla}
                onChange={(e) => setSigla(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="SP"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Periodicidade (meses)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={meses}
                onChange={(e) =>
                  setMeses(e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="12"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="São Paulo"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}