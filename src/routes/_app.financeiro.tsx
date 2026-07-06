import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCollection, type Moeda } from "@/lib/db";
import { money, formatDate } from "@/lib/format";
import { valorTotalEstado, isRealized, isProjected } from "@/lib/domain";
import { useFxRate, toBRL } from "@/lib/fx";
import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  parseISO,
  isWithinInterval,
} from "date-fns";

export const Route = createFileRoute("/_app/financeiro")({
  component: Financeiro,
});

type Period = "mes" | "trimestre" | "ano" | "custom";

function periodInterval(p: Period, from: string, to: string) {
  const now = new Date();
  if (p === "mes") return { start: startOfMonth(now), end: endOfMonth(now) };
  if (p === "trimestre")
    return { start: startOfQuarter(now), end: endOfQuarter(now) };
  if (p === "ano") return { start: startOfYear(now), end: endOfYear(now) };
  return {
    start: from ? parseISO(from) : new Date(0),
    end: to ? parseISO(to) : new Date(8640000000000000),
  };
}

function Financeiro() {
  const { items: fulfillments } = useCollection("fulfillments");
  const { items: patients } = useCollection("patients");
  const { items: brands } = useCollection("brands");
  const { rate, updatedAt } = useFxRate();
  const [period, setPeriod] = useState<Period>("mes");
  const [projMes, setProjMes] = useState<string>("todos");
  const [projAno, setProjAno] = useState<number>(new Date().getFullYear());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [moeda, setMoeda] = useState<Moeda>("BRL");

  const interval = periodInterval(period, from, to);

  const fulfillmentMoeda = (f: (typeof fulfillments)[number]): Moeda =>
    (f.items?.[0]?.moedaSnapshot as Moeda | undefined) ?? "BRL";

  const filtered = useMemo(
    () =>
      fulfillments.filter((f) => {
        if (!isWithinInterval(parseISO(f.dataDispensacao), interval)) return false;
        if (brandFilter !== "all" && f.brandIdSnapshot !== brandFilter) return false;
        if (fulfillmentMoeda(f) !== moeda) return false;
        return true;
      }),
    [fulfillments, interval, brandFilter, moeda]
  );

  const valorBruto = (f: (typeof fulfillments)[number]) => {
    if (f.items && f.items.length > 0) {
      return f.items
        .filter((it) => (it.moedaSnapshot ?? "BRL") === moeda)
        .reduce((a, it) => a + it.precoFrascoSnapshot * it.frascos, 0);
    }
    return f.precoFrascoSnapshot * f.frascos;
  };

  const totalRecebido = filtered.reduce((a, f) => a + f.valorRecebido, 0);
  const totalBruto = filtered.reduce((a, f) => a + valorBruto(f), 0);
  const totalFrascos = filtered.reduce((a, f) => a + f.frascos, 0);

  const porMarca = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; frascos: number; receita: number; bruto: number }
    >();
    for (const f of filtered) {
      const key = f.brandIdSnapshot ?? "—";
      const cur = map.get(key) ?? {
        nome: f.brandNomeSnapshot,
        frascos: 0,
        receita: 0,
        bruto: 0,
      };
      cur.frascos += f.frascos;
      cur.receita += f.valorRecebido;
      cur.bruto += valorBruto(f);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.bruto - a.bruto);
  }, [filtered, moeda]);

  const patientName = (id: string) =>
    patients.find((p) => p.id === id)?.nome ?? "—";

  // ===== Projeção (ano corrente, em BRL) =====
  const anoAtual = projAno;
  const toDisp = (f: (typeof fulfillments)[number]) => {
    const items = f.items ?? [];
    if (items.length === 0) {
      const v = valorTotalEstado(f);
      const m: Moeda = "BRL";
      const usarTaxa = isRealized(f) && f.fxTaxaFechada ? f.fxTaxaFechada : rate;
      const brl = toBRL(v, m, usarTaxa) ?? 0;
      return moeda === "BRL" ? brl : (rate ? brl / rate : 0);
    }
    return items.reduce((acc, it) => {
      const m: Moeda = (it.moedaSnapshot ?? "BRL") as Moeda;
      const v = it.precoFrascoSnapshot * it.frascos;
      const usarTaxa = isRealized(f) && f.fxTaxaFechada ? f.fxTaxaFechada : rate;
      const brl = toBRL(v, m, usarTaxa) ?? 0;
      return acc + (moeda === "BRL" ? brl : (rate ? brl / rate : 0));
    }, 0);
  };

  const doAno = fulfillments.filter((f) => {
    const d = f.dataRepasse || f.dataDispensacao || f.dataProtocolo;
    return d?.startsWith(String(anoAtual));
  });
  const noMes = (f: (typeof fulfillments)[number]) => {
    if (projMes === "todos") return true;
    const d = f.dataRepasse || f.dataDispensacao || f.dataProtocolo || "";
    return d.slice(5, 7) === projMes;
  };
  const recebidosList = doAno.filter((f) => isRealized(f)).filter(noMes);
  const recebidoAno = recebidosList.reduce((a, f) => a + toDisp(f), 0);
  const abertosList = fulfillments.filter((f) => isProjected(f) && !isRealized(f));
  const projecaoReceber = abertosList.reduce((a, f) => a + toDisp(f), 0);
  const totalFuturo = recebidoAno + projecaoReceber;
  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>();
    for (const f of fulfillments) {
      const d = f.dataRepasse || f.dataDispensacao || f.dataProtocolo;
      if (d) set.add(Number(d.slice(0, 4)));
    }
    const currentYear = new Date().getFullYear();
    for (let y = 2024; y <= currentYear; y++) set.add(y);
    return Array.from(set).sort((a, b) => b - a);
  }, [fulfillments]);

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Receita recebida e projeções futuras
          </p>
        </div>
        {rate && (
          <div className="text-right text-xs text-muted-foreground">
            <div>PTAX atual: <span className="font-medium text-foreground">R$ {rate.toFixed(4)}</span></div>
            {updatedAt && <div>{new Date(updatedAt).toLocaleDateString("pt-BR")}</div>}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Ano</Label>
              <Select value={String(projAno)} onValueChange={(v) => setProjAno(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mês</Label>
              <Select value={projMes} onValueChange={setProjMes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Ano inteiro</SelectItem>
                  {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Moeda de exibição</Label>
              <Select value={moeda} onValueChange={(v) => setMoeda(v as Moeda)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$ (Real)</SelectItem>
                  <SelectItem value="USD">US$ (Dólar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label={`Receita recebida (${anoAtual}${projMes === "todos" ? "" : "/" + projMes})`}
          value={money(recebidoAno, moeda)}
          hint={`${recebidosList.length} pagamento(s) · ${recebidosList.length} processo(s) concluído(s)`}
          tone="success"
        />
        <KpiCard
          label="A receber (projeção)"
          value={money(projecaoReceber, moeda)}
          hint={`${abertosList.length} cumprimento(s) · ${abertosList.length} processo(s) em aberto`}
          tone="warning"
        />
        <KpiCard
          label="Total projetado"
          value={money(totalFuturo, moeda)}
          hint="recebido + a receber"
          tone="default"
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Período (detalhamento)</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes">Mês atual</SelectItem>
                  <SelectItem value="trimestre">Trimestre atual</SelectItem>
                  <SelectItem value="ano">Ano atual</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Marca</Label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {period === "custom" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">De</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Até</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat label="Dispensações" value={String(filtered.length)} />
        <Stat label="Frascos" value={String(totalFrascos)} />
        <Stat label="Valor bruto CBD" value={money(totalBruto, moeda)} />
        <Stat label="Receita (Estado)" value={money(totalRecebido, moeda)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Por marca</CardTitle>
        </CardHeader>
        <CardContent>
          {porMarca.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sem dados no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="pb-2">Marca</th>
                    <th className="pb-2 text-right">Frascos</th>
                    <th className="pb-2 text-right">Valor bruto</th>
                    <th className="pb-2 text-right">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {porMarca.map((r) => (
                    <tr key={r.nome} className="border-b last:border-0">
                      <td className="py-3 font-medium">{r.nome}</td>
                      <td className="py-3 text-right">{r.frascos}</td>
                      <td className="py-3 text-right">{money(r.bruto, moeda)}</td>
                      <td className="py-3 text-right">{money(r.receita, moeda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dispensações no período</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma dispensação.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Paciente</th>
                    <th className="pb-2">Marca</th>
                    <th className="pb-2 text-right">Frascos</th>
                    <th className="pb-2 text-right">Valor bruto</th>
                    <th className="pb-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .slice()
                    .sort((a, b) => b.dataDispensacao.localeCompare(a.dataDispensacao))
                    .map((f) => (
                      <tr key={f.id} className="border-b last:border-0">
                        <td className="py-3">{formatDate(f.dataDispensacao)}</td>
                        <td className="py-3">{patientName(f.patientId)}</td>
                        <td className="py-3">{f.brandNomeSnapshot}</td>
                        <td className="py-3 text-right">{f.frascos}</td>
                        <td className="py-3 text-right">{money(valorBruto(f), moeda)}</td>
                        <td className="py-3 text-right">{money(f.valorRecebido, moeda)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "warning" | "default";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</p>
        {hint && (
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
