import { useEffect, useMemo, useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
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
  type Cumprimento,
  type CumprimentoItem,
  type CumprimentoStatus,
  type Fulfillment,
  type FulfillmentItem,
} from "@/lib/db";
import { brl, money, todayISO } from "@/lib/format";
import { useFxRate, toBRL } from "@/lib/fx";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  processoId: string;
  editing?: Cumprimento | null;
}

const DURACOES = [3, 6, 12, 24];

function computePeriodoFim(dataProtocolo: string, meses: number) {
  if (!dataProtocolo || !meses) return "";
  try {
    return format(addMonths(parseISO(dataProtocolo), meses), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

export function CumprimentoForm({ open, onOpenChange, processoId, editing }: Props) {
  const { upsert } = useCollection("cumprimentos");
  const { items: processos } = useCollection("processos");
  const { items: products } = useCollection("products");
  const { items: brands } = useCollection("brands");
  const { items: fulfillments, upsert: upsertFulfillment, remove: removeFulfillment } =
    useCollection("fulfillments");

  const processo = processos.find((p) => p.id === processoId);

  const [numero, setNumero] = useState("");
  const [dataProtocolo, setDataProtocolo] = useState(todayISO());
  const [duracaoMeses, setDuracaoMeses] = useState<number>(12);
  const [status, setStatus] = useState<CumprimentoStatus>("em_andamento");
  const [dataConclusao, setDataConclusao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [items, setItems] = useState<CumprimentoItem[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNumero(editing.numero);
      setDataProtocolo(editing.dataProtocolo);
      setDuracaoMeses(editing.duracaoMeses ?? 12);
      setStatus(editing.status);
      setDataConclusao(editing.dataConclusao ?? "");
      setObservacoes(editing.observacoes ?? "");
      setItems(editing.items ?? []);
    } else {
      setNumero("");
      setDataProtocolo(todayISO());
      setDuracaoMeses(12);
      setStatus("em_andamento");
      setDataConclusao("");
      setObservacoes("");
      setItems([]);
    }
  }, [open, editing]);

  const periodoFim = useMemo(
    () => computePeriodoFim(dataProtocolo, duracaoMeses),
    [dataProtocolo, duracaoMeses]
  );

  const lines = useMemo(
    () =>
      items.map((it) => {
        const prod = products.find((p) => p.id === it.productId);
        const brand = brands.find((b) => b.id === prod?.brandId);
        const receita = (prod?.precoFrasco ?? 0) * it.frascos;
        const comissao = (receita * (prod?.comissaoPct ?? 0)) / 100;
        const moeda = prod?.moeda ?? "BRL";
        return { it, prod, brand, moeda, receita, comissao };
      }),
    [items, products, brands]
  );
  const totalFrascos = lines.reduce((a, l) => a + l.it.frascos, 0);
  const { rate } = useFxRate();
  const totBRL = lines
    .filter((l) => l.moeda === "BRL")
    .reduce(
      (a, l) => ({ receita: a.receita + l.receita, comissao: a.comissao + l.comissao }),
      { receita: 0, comissao: 0 }
    );
  const totUSD = lines
    .filter((l) => l.moeda === "USD")
    .reduce(
      (a, l) => ({ receita: a.receita + l.receita, comissao: a.comissao + l.comissao }),
      { receita: 0, comissao: 0 }
    );
  // Totais para persistir (em BRL, convertendo se possível)
  const totalReceita =
    totBRL.receita + (toBRL(totUSD.receita, "USD", rate) ?? 0);
  const totalComissao =
    totBRL.comissao + (toBRL(totUSD.comissao, "USD", rate) ?? 0);

  function updateItem(i: number, patch: Partial<CumprimentoItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!numero.trim()) {
      toast.error("Informe o número do cumprimento");
      return;
    }
    if (status === "concluido" && items.length === 0) {
      toast.error("Adicione ao menos um produto para concluir a dispensa");
      return;
    }

    const id = editing?.id ?? uid();
    const finalDataConclusao =
      status === "concluido" ? dataConclusao || todayISO() : "";

    // Registrar / atualizar / remover a dispensa vinculada
    let fulfillmentId: string | null = editing?.fulfillmentId ?? null;
    if (status === "concluido" && processo) {
      const existing = fulfillmentId
        ? fulfillments.find((f) => f.id === fulfillmentId)
        : fulfillments.find((f) => f.cumprimentoId === id);
      const itemsSnap: FulfillmentItem[] = lines.map((l) => ({
        productId: l.prod?.id ?? null,
        brandNomeSnapshot: l.brand?.nome ?? "—",
        tipoSnapshot: l.prod?.tipo ?? "—",
        precoFrascoSnapshot: l.prod?.precoFrasco ?? 0,
        comissaoPctSnapshot: l.prod?.comissaoPct ?? 0,
        frascos: l.it.frascos,
        moedaSnapshot: l.prod?.moeda ?? "BRL",
      }));
      const first = lines[0];
      const f: Fulfillment = {
        id: existing?.id ?? uid(),
        patientId: processo.patientId,
        numeroCumprimento: numero.trim(),
        cumprimentoId: id,
        status: "repasse_recebido",
        dataProtocolo,
        dataDispensacao: finalDataConclusao,
        dataVencimento: periodoFim || finalDataConclusao,
        frascos: totalFrascos,
        valorRecebido: totalComissao,
        observacoes: observacoes.trim(),
        brandIdSnapshot: first?.brand?.id ?? null,
        brandNomeSnapshot: first?.brand?.nome ?? "—",
        precoFrascoSnapshot: first?.prod?.precoFrasco ?? 0,
        comissaoPctSnapshot: first?.prod?.comissaoPct ?? 0,
        comissaoValorSnapshot: totalFrascos > 0 ? totalComissao / totalFrascos : 0,
        items: itemsSnap,
        valorVendidoEstado: totalReceita,
        dataInvoiceSolicitada: existing?.dataInvoiceSolicitada ?? dataProtocolo,
        dataInvoiceEnviado: existing?.dataInvoiceEnviado ?? null,
        dataAguardandoLI: existing?.dataAguardandoLI ?? null,
        dataLI: existing?.dataLI ?? finalDataConclusao,
        dataTransito: existing?.dataTransito ?? null,
        dataDesembaraco: existing?.dataDesembaraco ?? null,
        dataLiberadoSES: existing?.dataLiberadoSES ?? null,
        dataPagoSES: existing?.dataPagoSES ?? null,
        dataRepasse: finalDataConclusao,
        etaDias: existing?.etaDias ?? 21,
        fxTaxaFechada: existing?.fxTaxaFechada ?? null,
        fxDataFechamento: existing?.fxDataFechamento ?? null,
        fxOrigem: existing?.fxOrigem ?? null,
      };
      upsertFulfillment(f);
      fulfillmentId = f.id;
    } else if (fulfillmentId) {
      // Se saiu de concluído, remove a dispensa gerada
      removeFulfillment(fulfillmentId);
      fulfillmentId = null;
    }

    const record: Cumprimento = {
      id,
      processoId,
      numero: numero.trim(),
      dataProtocolo,
      periodoInicio: dataProtocolo,
      periodoFim: periodoFim || undefined,
      status,
      observacoes: observacoes.trim() || undefined,
      duracaoMeses,
      dataConclusao: finalDataConclusao || undefined,
      items,
      fulfillmentId,
    };
    upsert(record);
    toast.success(
      status === "concluido"
        ? "Cumprimento concluído — dispensa registrada"
        : editing
          ? "Cumprimento atualizado"
          : "Cumprimento cadastrado"
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar cumprimento" : "Novo cumprimento de sentença"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Data protocolo (início)</Label>
              <Input
                type="date"
                value={dataProtocolo}
                onChange={(e) => setDataProtocolo(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select
                value={String(duracaoMeses)}
                onValueChange={(v) => setDuracaoMeses(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURACOES.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} meses
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fim do período</Label>
              <Input type="date" value={periodoFim} readOnly disabled />
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>Produtos do cumprimento</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems((prev) => [...prev, { productId: null, frascos: 1 }])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar produto
              </Button>
            </div>
            {lines.length === 0 && (
              <p className="text-sm italic text-muted-foreground">
                Nenhum produto. Ao concluir será registrada a dispensa com estes itens.
              </p>
            )}
            {lines.map((l, i) => (
              <div
                key={i}
                className="grid grid-cols-12 items-end gap-2 rounded-md border p-2"
              >
                <div className="col-span-7 space-y-1">
                  <Label className="text-xs">Produto</Label>
                  <Select
                    value={l.it.productId ?? ""}
                    onValueChange={(v) => updateItem(i, { productId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.length === 0 && (
                        <SelectItem value="__none" disabled>
                          Cadastre produtos em Marcas
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
                    min={1}
                    step={1}
                    value={String(l.it.frascos)}
                    onChange={(e) =>
                      updateItem(i, {
                        frascos: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                  />
                </div>
                <div className="col-span-2 text-right text-xs">
                  <div>{money(l.receita, l.moeda)}</div>
                  {l.moeda === "USD" && (
                    <div className="text-muted-foreground">
                      ≈ {rate ? brl(l.receita * rate) : "—"}
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    Com. {money(l.comissao, l.moeda)}
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
            {lines.length > 0 && (
              <div className="space-y-0.5 text-right text-sm">
                <div className="font-medium">{totalFrascos} frascos</div>
                {totBRL.receita > 0 && (
                  <div>
                    <span className="text-muted-foreground">Total R$: </span>
                    {brl(totBRL.receita)}{" "}
                    <span className="text-muted-foreground">
                      • Comissão {brl(totBRL.comissao)}
                    </span>
                  </div>
                )}
                {totUSD.receita > 0 && (
                  <div>
                    <span className="text-muted-foreground">Total US$: </span>
                    {money(totUSD.receita, "USD")}{" "}
                    <span className="text-muted-foreground">
                      • Comissão {money(totUSD.comissao, "USD")}
                      {rate && (
                        <> • ≈ {brl(totUSD.receita * rate)} (com. {brl(totUSD.comissao * rate)})</>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CumprimentoStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {status === "concluido" && (
              <div className="space-y-2">
                <Label>Data da conclusão</Label>
                <Input
                  type="date"
                  value={dataConclusao || todayISO()}
                  onChange={(e) => setDataConclusao(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
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