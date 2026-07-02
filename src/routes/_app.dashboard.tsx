import { createFileRoute, Link } from "@tanstack/react-router";
import { useCollection } from "@/lib/db";
import { computeStatus } from "@/lib/domain";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { items: patients } = useCollection("patients");
  const { items: fulfillments } = useCollection("fulfillments");
  const { items: brands } = useCollection("brands");

  const statuses = patients.map((p) => ({
    patient: p,
    status: computeStatus(p, fulfillments),
  }));

  const counts = {
    total: patients.length,
    red: statuses.filter((s) => s.status.color === "red").length,
    yellow: statuses.filter((s) => s.status.color === "yellow").length,
    green: statuses.filter((s) => s.status.color === "green").length,
  };

  const now = new Date();
  const monthInterval = { start: startOfMonth(now), end: endOfMonth(now) };
  const monthFulfillments = fulfillments.filter((f) =>
    isWithinInterval(parseISO(f.dataDispensacao), monthInterval)
  );
  const comissaoMes = monthFulfillments.reduce(
    (acc, f) => acc + f.comissaoValorSnapshot * f.frascos,
    0
  );
  const receitaMes = monthFulfillments.reduce((acc, f) => acc + f.valorRecebido, 0);

  const attention = statuses
    .filter((s) => s.status.color === "red" || s.status.color === "yellow")
    .sort((a, b) => (a.status.daysToExpire ?? 0) - (b.status.daysToExpire ?? 0));

  const brandName = (id: string | null) =>
    brands.find((b) => b.id === id)?.nome ?? "—";

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral de pacientes e cumprimentos
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Pacientes" value={String(counts.total)} />
        <StatCard label="Vencidos" value={String(counts.red)} tone="red" />
        <StatCard label="Em alerta" value={String(counts.yellow)} tone="yellow" />
        <StatCard label="Em dia" value={String(counts.green)} tone="green" />
        <StatCard label="Comissão do mês" value={brl(comissaoMes)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Precisa de atenção</CardTitle>
        </CardHeader>
        <CardContent>
          {attention.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum paciente com alerta no momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="pb-2">Paciente</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2">Marca</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {attention.map(({ patient, status }) => (
                    <tr key={patient.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{patient.nome}</td>
                      <td className="py-3">{patient.estado}</td>
                      <td className="py-3">{brandName(patient.brandId)}</td>
                      <td className="py-3">
                        <StatusBadge color={status.color} label={status.label} />
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          to="/pacientes/$id"
                          params={{ id: patient.id }}
                        >
                          <Button size="sm" variant="outline">
                            Abrir
                          </Button>
                        </Link>
                      </td>
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
          <CardTitle>Receita do mês</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{brl(receitaMes)}</p>
          <p className="text-sm text-muted-foreground">
            {monthFulfillments.length} dispensação(ões) neste mês
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "red" | "yellow" | "green";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-600"
      : tone === "yellow"
        ? "text-yellow-600"
        : tone === "green"
          ? "text-green-600"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
