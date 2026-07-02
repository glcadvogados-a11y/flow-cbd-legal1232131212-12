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
import { addMonths, format } from "date-fns";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patient: Patient;
}

export function FulfillmentForm({ open, onOpenChange, patient }: Props) {
  const { items: brands } = useCollection("brands");
  const { items: states } = useCollection("states");
  const { upsert } = useCollection("fulfillments");

  const [numeroCumprimento, setNumeroCumprimento] = useState("");
  const [dataProtocolo, setDataProtocolo] = useState(todayISO());
  const [dataDispensacao, setDataDispensacao] = useState(todayISO());
  const [dataVencimento, setDataVencimento] = useState("");
  const [frascos, setFrascos] = useState<string>(String(patient.frascosPorPedido));
  const [valorRecebido, setValorRecebido] = useState<string>("0");
  const [observacoes, setObservacoes] = useState("");

  const brand = brands.find((b) => b.id === patient.brandId);
  const stateInfo = states.find((s) => s.sigla === patient.estado);

  useEffect(() => {
    if (open) {
      setNumeroCumprimento("");
      setDataProtocolo(todayISO());
      const hoje = todayISO();
      setDataDispensacao(hoje);
      // sugerir vencimento com base na periodicidade do estado
      const meses = stateInfo?.mesesFornecimento ?? 12;
      setDataVencimento(format(addMonths(new Date(hoje), meses), "yyyy-MM-dd"));
      setFrascos(String(patient.frascosPorPedido));
      setValorRecebido(
        brand ? String(brand.precoFrasco * patient.frascosPorPedido) : "0"
      );
      setObservacoes("");
    }
  }, [open, patient, brand, stateInfo]);

  const frascosN = Math.max(0, parseInt(frascos, 10) || 0);
  const comissaoUnit = brand
    ? comissaoPorFrasco(brand.precoFrasco, brand.comissaoPct)
    : 0;
  const comissaoTotal = comissaoUnit * frascosN;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dataVencimento) {
      toast.error("Informe a data de vencimento do estoque");
      return;
    }
    const f: Fulfillment = {
      id: uid(),
      patientId: patient.id,
      numeroCumprimento: numeroCumprimento.trim(),
      dataProtocolo,
      dataDispensacao,
      dataVencimento,
      frascos: frascosN,
      valorRecebido: Number(valorRecebido) || 0,
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
          <div className="space-y-2">
            <Label>Nº do cumprimento de sentença</Label>
            <Input
              value={numeroCumprimento}
              onChange={(e) => setNumeroCumprimento(e.target.value)}
              placeholder="Ex: 1234567-89.2024.8.26.0100"
            />
          </div>
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
                inputMode="numeric"
                min={1}
                step={1}
                value={frascos}
                onChange={(e) => setFrascos(e.target.value.replace(/[^\d]/g, ""))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Valor recebido (R$)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step={1}
              min={0}
              value={valorRecebido}
              onChange={(e) => setValorRecebido(e.target.value)}
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
