import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCollection, uid, TIPOS_CBD, type Product, type TipoCBD } from "@/lib/db";
import { comissaoPorFrasco } from "@/lib/domain";
import { brl } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brandId: string;
  editing?: Product | null;
}

export function ProductForm({ open, onOpenChange, brandId, editing }: Props) {
  const { upsert } = useCollection("products");
  const [tipo, setTipo] = useState<TipoCBD>("Full Spectrum");
  const [preco, setPreco] = useState("");
  const [pct, setPct] = useState("");
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (editing) {
      setTipo(editing.tipo);
      setPreco(String(editing.precoFrasco));
      setPct(String(editing.comissaoPct));
      setAtivo(editing.ativo);
    } else {
      setTipo("Full Spectrum");
      setPreco("");
      setPct("");
      setAtivo(true);
    }
  }, [editing, open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    upsert({
      id: editing?.id ?? uid(),
      brandId,
      tipo,
      precoFrasco: Number(preco) || 0,
      comissaoPct: Number(pct) || 0,
      ativo,
    });
    toast.success(editing ? "Produto atualizado" : "Produto cadastrado");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCBD)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CBD.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preço/frasco (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step={1}
                min={0}
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Comissão (%)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step={1}
                min={0}
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Comissão/frasco:{" "}
            <span className="font-medium text-foreground">
              {brl(comissaoPorFrasco(Number(preco) || 0, Number(pct) || 0))}
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