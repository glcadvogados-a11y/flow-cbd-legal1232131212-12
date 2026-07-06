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
import { useCollection, uid, TIPOS_CBD, MOEDAS, type Product, type TipoCBD, type Moeda } from "@/lib/db";
import { comissaoPorFrasco } from "@/lib/domain";
import { money } from "@/lib/format";
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
  const [moeda, setMoeda] = useState<Moeda>("BRL");
  const [preco, setPreco] = useState("");
  const [pct, setPct] = useState("");
  const [mg, setMg] = useState("1500");
  const [ml, setMl] = useState("30");
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (editing) {
      setTipo(editing.tipo);
      setMoeda(editing.moeda ?? "BRL");
      setPreco(String(editing.precoFrasco));
      setPct(String(editing.comissaoPct));
      setMg(String(editing.concentracaoMg ?? 1500));
      setMl(String(editing.volumeMl ?? 30));
      setAtivo(editing.ativo);
    } else {
      setTipo("Full Spectrum");
      setMoeda("BRL");
      setPreco("");
      setPct("");
      setMg("1500");
      setMl("30");
      setAtivo(true);
    }
  }, [editing, open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    upsert({
      id: editing?.id ?? uid(),
      brandId,
      tipo,
      moeda,
      precoFrasco: Number(preco) || 0,
      comissaoPct: Number(pct) || 0,
      concentracaoMg: Number(mg) || 0,
      volumeMl: Number(ml) || 0,
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
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label>Moeda</Label>
              <Select value={moeda} onValueChange={(v) => setMoeda(v as Moeda)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOEDAS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m === "BRL" ? "R$ (Real)" : "US$ (Dólar)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preço/frasco</Label>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Concentração (mg)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                value={mg}
                onChange={(e) => setMg(e.target.value)}
                placeholder="1500"
              />
            </div>
            <div className="space-y-2">
              <Label>Volume (ml)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={ml}
                onChange={(e) => setMl(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Comissão/frasco:{" "}
            <span className="font-medium text-foreground">
              {money(comissaoPorFrasco(Number(preco) || 0, Number(pct) || 0), moeda)}
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