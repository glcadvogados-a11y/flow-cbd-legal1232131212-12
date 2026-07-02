import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  type Fulfillment,
  type Patient,
} from "@/lib/db";
import { comissaoPorFrasco } from "@/lib/domain";
import { todayISO, brl } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patient: Patient;
}

export function FulfillmentForm({ open, onOpenChange, patient }: Props) {
  const { items: brands } = useCollection("brands");
  const { upsert } = useCollection("fulfillments");

  const [dataProtocolo, setDataProtocolo] = useState(todayISO());
  const [dataDispensacao, setDataDispensacao] = useState(todayISO());
  const [dataVencimento, setDataVencimento] = useState("");
  const [frascos, setFrascos] = useState(patient.frascosPorPedido);
  const [valorRecebido, setValorRecebido] = useState(0);
  const [observacoes, setObservacoes] = useState("");

  const brand = brands.find((b) => b.id === patient.brandId);

  useEffect(() => {
    if (open) {
      setDataProtocolo(todayISO());
      setDataDispensacao(todayISO());
      setDataVencimento("");
      setFrascos(patient.frascosPorPedido);
      setValorRecebido(brand ? brand.precoFrasco * patient.frascosPorPedido : 0);
      setObservacoes("");
    }
  }, [open, patient, brand]);

  const comissaoUnit = brand
    ? comissaoPorFrasco(brand.precoFrasco, brand.comissaoPct)
    : 0;
  const comissaoTotal = comissaoUnit * frascos;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dataVencimento) {
      toast.error("Informe a data de vencimento do estoque");
      return;
    }
    const f: Fulfillment = {
      id: uid(),
      patientId: patient.id,
      dataProtocolo,
      dataDispensacao,
      dataVencimento,
      frascos: Number(frascos),
      valorRecebido: Number(valorRecebido),
      observacoes,
      brandIdSnapshot: brand?.id ?? null,
      brandNomeSnapshot: brand?.nome ?? "—",
      precoFrascoSnapshot: brand?.precoFrasco ?? 0,
      comissaoPctSnapshot: brand?.comissaoPct ?? 0,
      comissaoValorSnapshot: comissaoUnit,
    };
    upsert(f);
    toast.success("Cumprimento registrado");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cumprimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data do protocolo</Label>
              <Input
                type="date"
                value={dataProtocolo}
                onChange={(e) => setDataProtocolo(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Data da dispensação</Label>
              <Input
                type="date"
                value={dataDispensacao}
                onChange={(e) => setDataDispensacao(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vencimento do estoque</Label>
              <Input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Frascos dispensados</Label>
              <Input
                type="number"
                min={1}
                value={frascos}
                onChange={(e) => setFrascos(Number(e.target.value))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Valor recebido (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={valorRecebido}
              onChange={(e) => setValorRecebido(Number(e.target.value))}
            />
            {brand && (
              <p className="text-xs text-muted-foreground">
                Marca: {brand.nome} • {brl(brand.precoFrasco)}/frasco • Comissão:{" "}
                {brl(comissaoUnit)}/frasco = {brl(comissaoTotal)} total
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Registrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
