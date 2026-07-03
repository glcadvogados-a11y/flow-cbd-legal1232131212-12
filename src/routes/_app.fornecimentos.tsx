import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCollection } from "@/lib/db";
import { FUNIL_STEPS, comissaoTotal, valorTotalEstado, frascosTotal, etaRecebimento } from "@/lib/domain";
import { brl, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/fornecimentos")({
  component: FornecimentosPage,
});

function FornecimentosPage() {
  const { items: fulfillments } = useCollection("fulfillments");
  const { items: patients } = useCollection("patients");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const patientName = (id: string) => patients.find((p) => p.id === id)?.nome ?? "—";

  const filtered = useMemo(
    () =>
      fulfillments
        .filter((f) => statusFilter === "all" || (f.status ?? "repasse_recebido") === statusFilter)
        .sort((a, b) => (b.dataProtocolo ?? "").localeCompare(a.dataProtocolo ?? "")),
    [fulfillments, statusFilter]
  );

  const funilCounts = FUNIL_STEPS.map((s) => ({
    ...s,
    count: fulfillments.filter((f) => (f.status ?? "repasse_recebido") === s.key).length,
  }));

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Fornecimentos</h1>
        <p className="text-sm text-muted-foreground">
          Funil de pedidos à SES ({fulfillments.length} total)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {funilCounts.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`rounded-md border p-3 text-left transition-colors ${
              statusFilter === s.key ? "border-primary bg-accent" : "hover:bg-muted/50"
            }`}
          >
            <div className="text-xs text-muted-foreground">{s.short}</div>
            <div className="text-xl font-semibold">{s.count}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Filtro:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {FUNIL_STEPS.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="p-3">Paciente</th>
                  <th className="p-3">Nº cumprimento</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Protocolo</th>
                  <th className="p-3">ETA / Repasse</th>
                  <th className="p-3 text-right">Frascos</th>
                  <th className="p-3 text-right">Estado (R$)</th>
                  <th className="p-3 text-right">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum fornecimento.</td></tr>
                )}
                {filtered.map((f) => {
                  const step = FUNIL_STEPS.find((s) => s.key === (f.status ?? "repasse_recebido"));
                  const eta = f.dataRepasse ?? etaRecebimento(f);
                  return (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="p-3">
                        <Link to="/pacientes/$id" params={{ id: f.patientId }} className="font-medium hover:underline">
                          {patientName(f.patientId)}
                        </Link>
                      </td>
                      <td className="p-3 font-mono text-xs">{f.numeroCumprimento || "—"}</td>
                      <td className="p-3">{step?.short}</td>
                      <td className="p-3">{formatDate(f.dataProtocolo)}</td>
                      <td className="p-3">{eta ? formatDate(eta) : "—"}</td>
                      <td className="p-3 text-right">{frascosTotal(f)}</td>
                      <td className="p-3 text-right">{brl(valorTotalEstado(f))}</td>
                      <td className="p-3 text-right">{brl(comissaoTotal(f))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}