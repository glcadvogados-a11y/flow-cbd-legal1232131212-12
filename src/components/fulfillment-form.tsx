import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  useCollection,
  uid,
  type Fulfillment,
  type FulfillmentItem,
  type FunilStatus,
  type Patient,
} from "@/lib/db";
import { FUNIL_STEPS, ETA_DIAS_DEFAULT, comissaoItem } from "@/lib/domain";
import { brl, todayISO } from "@/lib/format";
import { addMonths, format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patient: Patient;
  editing?: Fulfillment | null;
  cumprimentoId?: string | null;
}

type Draft = Omit<FulfillmentItem, "brandNomeSnapshot" | "tipoSnapshot" | "precoFrascoSnapshot" | "comissaoPctSnapshot"> & {
  productId: string | null;
  frascos: number;
};

export function FulfillmentForm({
  open,
  onOpenChange,
  patient,
  editing,
  cumprimentoId,
}: Props) {
  const { items: brands } = useCollection("brands");
  const { items: products } = useCollection("products");
  const { items: cumprimentos } = useCollection("cumprimentos");
  const { items: processos } = useCollection("processos");
  const { items: states } = useCollection("states");
  const { upsert } = useCollection("fulfillments");

  const [numeroCumprimento, setNumeroCumprimento] = useState("");
  const [cumpId, setCumpId] = useState<string>(cumprimentoId ?? "none");
  const [status, setStatus] = useState<FunilStatus>("solicitacao_invoice");
  const [dataProtocolo, setDataProtocolo] = useState(todayISO());
  const [dataDispensacao, setDataDispensacao] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [dataInvoiceSolicitada, setDataInvoiceSolicitada] = useState("");
  const [dataInvoiceEnviado, setDataInvoiceEnviado] = useState("");
  const [dataAguardandoLI, setDataAguardandoLI] = useState("");
  const [dataLI, setDataLI] = useState("");
  const [dataTransito, setDataTransito] = useState("");
  const [dataDesembaraco, setDataDesembaraco] = useState("");
  const [dataLiberadoSES, setDataLiberadoSES] = useState("");
  const [dataPagoSES, setDataPagoSES] = useState("");
  const [dataRepasse, setDataRepasse] = useState("");
  const [etaDias, setEtaDias] = useState<string>(String(ETA_DIAS_DEFAULT));
  const [valorVendido, setValorVendido] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [items, setItems] = useState<Draft[]>([]);

  const patientProcessos = processos.filter((p) => p.patientId === patient.id);
  const patientCumprimentos = cumprimentos.filter((c) =>
    patientProcessos.some((p) => p.id === c.processoId)
  );

  const stateInfo = states.find((s) => s.sigla === patient.estado);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNumeroCumprimento(editing.numeroCumprimento);
      setCumpId(editing.cumprimentoId ?? "none");
      setStatus(editing.status ?? "repasse_recebido");
      setDataProtocolo(editing.dataProtocolo);
      setDataDispensacao(editing.dataDispensacao ?? "");
      setDataVencimento(editing.dataVencimento ?? "");
      setDataInvoiceSolicitada(editing.dataInvoiceSolicitada ?? "");
      setDataInvoiceEnviado(editing.dataInvoiceEnviado ?? "");
      setDataAguardandoLI(editing.dataAguardandoLI ?? "");
      setDataLI(editing.dataLI ?? "");
      setDataTransito(editing.dataTransito ?? "");
      setDataDesembaraco(editing.dataDesembaraco ?? "");
      setDataLiberadoSES(editing.dataLiberadoSES ?? "");
      setDataPagoSES(editing.dataPagoSES ?? "");
      setDataRepasse(editing.dataRepasse ?? "");
      setEtaDias(String(editing.etaDias ?? ETA_DIAS_DEFAULT));
      setValorVendido(
        editing.valorVendidoEstado ? String(editing.valorVendidoEstado) : ""
      );
      setObservacoes(editing.observacoes ?? "");
      setItems(
        (editing.items ?? []).map((it) => ({
          productId: it.productId,
          frascos: it.frascos,
        }))
      );
    } else {
      const hoje = todayISO();
      setNumeroCumprimento("");
      setCumpId(cumprimentoId ?? "none");
      setStatus("solicitacao_invoice");
      setDataProtocolo(hoje);
      setDataDispensacao("");
      const meses = stateInfo?.mesesFornecimento ?? 12;
      setDataVencimento(format(addMonths(new Date(hoje), meses), "yyyy-MM-dd"));
      setDataInvoiceSolicitada(hoje);
      setDataInvoiceEnviado("");
      setDataAguardandoLI("");
      setDataLI("");
      setDataTransito("");
      setDataDesembaraco("");
      setDataLiberadoSES("");
      setDataPagoSES("");
      setDataRepasse("");
      setEtaDias(String(ETA_DIAS_DEFAULT));
      setValorVendido("");
      setObservacoes("");
      // sugere um item vazio com marca preferida do paciente se houver produto
      const first = products.find((p) => p.brandId === patient.brandId && p.ativo);
      setItems(
        first
          ? [{ productId: first.id, frascos: patient.frascosPorPedido }]
          : []
      );
    }
  }, [open, editing, cumprimentoId, patient, products, stateInfo]);

  const itemLines = useMemo(
    () =>
      items.map((it) => {
        const prod = products.find((p) => p.id === it.productId);
        const brand = brands.find((b) => b.id === prod?.brandId);
        const item: FulfillmentItem = {
          productId: prod?.id ?? null,
          brandNomeSnapshot: brand?.nome ?? "—",
          tipoSnapshot: prod?.tipo ?? "—",
          precoFrascoSnapshot: prod?.precoFrasco ?? 0,
          comissaoPctSnapshot: prod?.comissaoPct ?? 0,
          frascos: it.frascos,
          moedaSnapshot: prod?.moeda ?? "BRL",
        };
        return {
          draft: it,
          prod,
          brand,
          item,
          receita: (prod?.precoFrasco ?? 0) * it.frascos,
          comissao: comissaoItem(item),
        };
      }),
    [items, products, brands]
  );

  const totalReceita = itemLines.reduce((a, l) => a + l.receita, 0);
  const totalComissao = itemLines.reduce((a, l) => a + l.comissao, 0);
  const totalFrascos = itemLines.reduce((a, l) => a + l.draft.frascos, 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (itemLines.length === 0) {
      toast.error("Adicione ao menos um item (produto)");
      return;
    }
    const itemsSnap: FulfillmentItem[] = itemLines.map((l) => l.item);
    const firstBrand = itemLines[0].brand;
    const firstProd = itemLines[0].prod;

    const f: Fulfillment = {
      id: editing?.id ?? uid(),
      patientId: patient.id,
      numeroCumprimento: numeroCumprimento.trim(),
      cumprimentoId: cumpId === "none" ? null : cumpId,
      status,
      dataProtocolo,
      dataDispensacao:
        dataDispensacao || dataRepasse || dataLiberadoSES || dataProtocolo,
      dataVencimento,
      frascos: totalFrascos,
      valorRecebido: totalComissao,
      observacoes,
      brandIdSnapshot: firstBrand?.id ?? null,
      brandNomeSnapshot: firstBrand?.nome ?? "—",
      precoFrascoSnapshot: firstProd?.precoFrasco ?? 0,
      comissaoPctSnapshot: firstProd?.comissaoPct ?? 0,
      comissaoValorSnapshot:
        totalFrascos > 0 ? totalComissao / totalFrascos : 0,
      items: itemsSnap,
      valorVendidoEstado: valorVendido ? Number(valorVendido) : totalReceita,
      dataInvoiceSolicitada: dataInvoiceSolicitada || null,
      dataInvoiceEnviado: dataInvoiceEnviado || null,
      dataAguardandoLI: dataAguardandoLI || null,
      dataLI: dataLI || null,
      dataTransito: dataTransito || null,
      dataDesembaraco: dataDesembaraco || null,
      dataLiberadoSES: dataLiberadoSES || null,
      dataPagoSES: dataPagoSES || null,
      dataRepasse: dataRepasse || null,
      etaDias: Number(etaDias) || ETA_DIAS_DEFAULT,
    };
    upsert(f);
    toast.success(editing ? "Fornecimento atualizado" : "Fornecimento registrado");
    onOpenChange(false);
  }

  function updateItem(i: number, patch: Partial<Draft>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar fornecimento" : "Novo fornecimento"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          {/* Vinculação */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cumprimento de sentença</Label>
              <Select value={cumpId} onValueChange={setCumpId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem vínculo —</SelectItem>
                  {patientCumprimentos.map((c) => {
                    const proc = patientProcessos.find((p) => p.id === c.processoId);
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {c.numero} ({proc?.numeroCNJ})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nº cumprimento (texto livre)</Label>
              <Input
                value={numeroCumprimento}
                onChange={(e) => setNumeroCumprimento(e.target.value)}
                placeholder="Ex: 1234567-89.2024.8.26.0100"
              />
            </div>
          </div>

          {/* Itens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens do fornecimento</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { productId: null, frascos: 1 },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar item
              </Button>
            </div>
            {itemLines.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Nenhum item — clique em "Adicionar item" e escolha o produto.
              </p>
            )}
            {itemLines.map((l, i) => (
              <div
                key={i}
                className="grid grid-cols-12 items-end gap-2 rounded-md border p-2"
              >
                <div className="col-span-6 space-y-1">
                  <Label className="text-xs">Produto (Marca + Tipo)</Label>
                  <Select
                    value={l.draft.productId ?? ""}
                    onValueChange={(v) => updateItem(i, { productId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.length === 0 && (
                        <SelectItem value="__none" disabled>
                          Cadastre produtos em Marcas & Produtos
                        </SelectItem>
                      )}
                      {products.map((p) => {
                        const b = brands.find((x) => x.id === p.brandId);
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            {b?.nome ?? "?"} — {p.tipo} ({brl(p.precoFrasco)})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Frascos</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={String(l.draft.frascos)}
                    onChange={(e) =>
                      updateItem(i, {
                        frascos: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                  />
                </div>
                <div className="col-span-3 text-right text-xs">
                  <div>Receita: {brl(l.receita)}</div>
                  <div className="text-muted-foreground">
                    Comissão: {brl(l.comissao)}
                  </div>
                </div>
                <div className="col-span-1 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setItems((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {itemLines.length > 0 && (
              <p className="text-right text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-medium">
                  {totalFrascos} frascos • Receita {brl(totalReceita)} • Comissão{" "}
                  {brl(totalComissao)}
                </span>
              </p>
            )}
          </div>

          {/* Status funil */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status atual</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as FunilStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUNIL_STEPS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ETA após L.I. (dias)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={etaDias}
                onChange={(e) => setEtaDias(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </div>

          {/* Datas do funil */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">Datas do fluxo</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <DateField label="Protocolo" value={dataProtocolo} onChange={setDataProtocolo} />
              <DateField label="Invoice solicitada" value={dataInvoiceSolicitada} onChange={setDataInvoiceSolicitada} />
              <DateField label="Invoice enviada" value={dataInvoiceEnviado} onChange={setDataInvoiceEnviado} />
              <DateField label="Aguardando L.I." value={dataAguardandoLI} onChange={setDataAguardandoLI} />
              <DateField label="L.I. emitida" value={dataLI} onChange={setDataLI} />
              <DateField label="Em trânsito" value={dataTransito} onChange={setDataTransito} />
              <DateField label="Desembaraço RF" value={dataDesembaraco} onChange={setDataDesembaraco} />
              <DateField label="Liberado SES" value={dataLiberadoSES} onChange={setDataLiberadoSES} />
              <DateField label="Pago pela SES" value={dataPagoSES} onChange={setDataPagoSES} />
              <DateField label="Repasse recebido" value={dataRepasse} onChange={setDataRepasse} />
              <DateField label="Dispensação (paciente)" value={dataDispensacao} onChange={setDataDispensacao} />
              <DateField label="Vencimento do estoque" value={dataVencimento} onChange={setDataVencimento} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor vendido ao Estado (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step={1}
                min={0}
                value={valorVendido}
                onChange={(e) => setValorVendido(e.target.value)}
                placeholder={String(totalReceita)}
              />
              <p className="text-xs text-muted-foreground">
                Se vazio, usa o somatório dos itens ({brl(totalReceita)}).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>
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

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}