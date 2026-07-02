import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCollection, uid, type Brand } from "@/lib/db";
import { comissaoPorFrasco } from "@/lib/domain";
import { brl } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Brand | null;
}

export function BrandForm({ open, onOpenChange, editing }: Props) {
  const { upsert } = useCollection("brands");
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (editing) {
      setNome(editing.nome);
      setPreco(editing.precoFrasco);
      setPct(editing.comissaoPct);
    } else {
      setNome("");
      setPreco(0);
      setPct(0);
    }
  }, [editing, open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome da marca");
      return;
    }
    upsert({
      id: editing?.id ?? uid(),
      nome: nome.trim(),
      precoFrasco: Number(preco),
      comissaoPct: Number(pct),
    });
    toast.success(editing ? "Marca atualizada" : "Marca cadastrada");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar marca" : "Nova marca"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preço por frasco (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Comissão (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Comissão por frasco:{" "}
            <span className="font-medium text-foreground">
              {brl(comissaoPorFrasco(preco, pct))}
            </span>
          </p>
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
