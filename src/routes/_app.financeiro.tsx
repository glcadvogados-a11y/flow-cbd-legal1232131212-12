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
  const [period, setPeriod] = useState<Period>("mes");
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

  const totalRecebido = filtered.reduce((a, f) => a + f.valorRecebido, 0);
  const totalComissao = filtered.reduce(
    (a, f) => a + f.comissaoValorSnapshot * f.frascos,
    0
  );
  const totalFrascos = filtered.reduce((a, f) => a + f.frascos, 0);

  const porMarca = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; frascos: number; receita: number; comissao: number }
    >();
    for (const f of filtered) {
      const key = f.brandIdSnapshot ?? "—";
      const cur = map.get(key) ?? {
        nome: f.brandNomeSnapshot,
        frascos: 0,
        receita: 0,
        comissao: 0,
      };
      cur.frascos += f.frascos;
      cur.receita += f.valorRecebido;
      cur.comissao += f.comissaoValorSnapshot * f.frascos;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.comissao - a.comissao);
  }, [filtered]);

  const patientName = (id: string) =>
    patients.find((p) => p.id === id)?.nome ?? "—";

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Receita e comissões por período
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Moeda</Label>
              <Select value={moeda} onValueChange={(v) => setMoeda(v as Moeda)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$ (Real)</SelectItem>
                  <SelectItem value="USD">US$ (Dólar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
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
        <Stat label="Receita (Estado)" value={money(totalRecebido, moeda)} />
        <Stat label="Comissão" value={money(totalComissao, moeda)} />
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
                    <th className="pb-2 text-right">Receita</th>
                    <th className="pb-2 text-right">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {porMarca.map((r) => (
                    <tr key={r.nome} className="border-b last:border-0">
                      <td className="py-3 font-medium">{r.nome}</td>
                      <td className="py-3 text-right">{r.frascos}</td>
                      <td className="py-3 text-right">{money(r.receita, moeda)}</td>
                      <td className="py-3 text-right">{money(r.comissao, moeda)}</td>
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
                    <th className="pb-2 text-right">Valor</th>
                    <th className="pb-2 text-right">Comissão</th>
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
                        <td className="py-3 text-right">{money(f.valorRecebido, moeda)}</td>
                        <td className="py-3 text-right">
                          {money(f.comissaoValorSnapshot * f.frascos, moeda)}
                        </td>
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
