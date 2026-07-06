import { useState, useEffect } from "react";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useCollection,
  uid,
  TIPOS_CBD,
  MOEDAS,
  type Brand,
  type Product,
  type TipoCBD,
  type Moeda,
} from "@/lib/db";
import { comissaoPorFrasco } from "@/lib/domain";
import { money } from "@/lib/format";
import { useFxRate, toBRL, toUSD } from "@/lib/fx";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Brand | null;
}

export function BrandForm({ open, onOpenChange, editing }: Props) {
  const { upsert } = useCollection("brands");
  const { items: products, upsert: upsertProduct } = useCollection("products");
  const { rate } = useFxRate();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCBD>("Full Spectrum");
  const [moeda, setMoeda] = useState<Moeda>("BRL");
  const [preco, setPreco] = useState<string>("");
  const [pct, setPct] = useState<string>("");
  const [existingProductId, setExistingProductId] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setNome(editing.nome);
      const p = products.find((x) => x.brandId === editing.id);
      if (p) {
        setExistingProductId(p.id);
        setTipo(p.tipo);
        setMoeda(p.moeda ?? "BRL");
        setPreco(String(p.precoFrasco));
        setPct(String(p.comissaoPct));
      } else {
        setExistingProductId(null);
        setTipo("Full Spectrum");
        setMoeda("BRL");
        setPreco(String(editing.precoFrasco));
        setPct(String(editing.comissaoPct));
      }
    } else {
      setExistingProductId(null);
      setNome("");
      setTipo("Full Spectrum");
      setMoeda("BRL");
      setPreco("");
      setPct("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome da marca");
      return;
    }
    const brandId = editing?.id ?? uid();
    const precoNum = Number(preco) || 0;
    const pctNum = Number(pct) || 0;
    upsert({
      id: brandId,
      nome: nome.trim(),
      precoFrasco: precoNum,
      comissaoPct: pctNum,
    });
    const productPayload: Product = {
      id: existingProductId ?? uid(),
      brandId,
      tipo,
      moeda,
      precoFrasco: precoNum,
      comissaoPct: pctNum,
      concentracaoMg: 1500,
      volumeMl: 30,
      ativo: true,
    };
    upsertProduct(productPayload);
    toast.success(editing ? "Marca atualizada" : "Marca cadastrada");
    onOpenChange(false);
  }

  const precoNum = Number(preco) || 0;
  const pctNum = Number(pct) || 0;
  const comissao = comissaoPorFrasco(precoNum, pctNum);
  const equiv = moeda === "USD" ? toBRL(comissao, "USD", rate) : toUSD(comissao, "BRL", rate);
  const equivMoeda: Moeda = moeda === "USD" ? "BRL" : "USD";

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
          <div className="space-y-2">
            <Label>Tipo de produto</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCBD)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CBD.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label>Preço por frasco</Label>
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
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div>
              Comissão por frasco:{" "}
              <span className="font-medium text-foreground">{money(comissao, moeda)}</span>
            </div>
            {equiv != null && (
              <div className="text-muted-foreground">
                Equivalente em {equivMoeda === "BRL" ? "BRL" : "USD"}:{" "}
                <span className="font-medium text-foreground">{money(equiv, equivMoeda)}</span>
                {rate && (
                  <span className="ml-1 text-xs">(PTAX 1 USD = R$ {rate.toFixed(4)})</span>
                )}
              </div>
            )}
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
