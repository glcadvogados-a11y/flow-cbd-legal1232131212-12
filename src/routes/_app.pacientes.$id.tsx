import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCollection } from "@/lib/db";
import { computeStatus, funilStep, valorTotalEstado, frascosTotal, computeProtocolCountdown } from "@/lib/domain";
import { StatusBadge } from "@/components/status-badge";
import { FulfillmentForm } from "@/components/fulfillment-form";
import { PatientForm } from "@/components/patient-form";
import { brl, formatDate } from "@/lib/format";
import { differenceInCalendarDays, parseISO, addMonths, format } from "date-fns";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pacientes/$id")({
  component: PatientDetail,
});

function PatientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { items: patients, upsert, remove } = useCollection("patients");
  const { items: fulfillments, remove: removeFul } = useCollection("fulfillments");
  const { items: brands } = useCollection("brands");
  const { items: states } = useCollection("states");
  const { items: processos } = useCollection("processos");
  const { items: cumprimentos } = useCollection("cumprimentos");
  const [ffOpen, setFfOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const patient = patients.find((p) => p.id === id);

  if (!patient) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Paciente não encontrado.</p>
        <Link to="/pacientes">
          <Button variant="outline" className="mt-4">
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const own = fulfillments
    .filter((f) => f.patientId === patient.id)
    .sort((a, b) => (b.dataProtocolo || "").localeCompare(a.dataProtocolo || ""));
  const status = computeStatus(patient, fulfillments);
  const brand = brands.find((b) => b.id === patient.brandId);
  const stateInfo = states.find((s) => s.sigla === patient.estado);

  const patientProcessos = processos.filter((p) => p.patientId === patient.id);
  const patientProcIds = new Set(patientProcessos.map((p) => p.id));
  const patientCumprimentos = cumprimentos.filter((c) => patientProcIds.has(c.processoId));

  const leadTimes = own
    .filter((f) => f.dataProtocolo && f.dataDispensacao)
    .map((f) => differenceInCalendarDays(parseISO(f.dataDispensacao), parseISO(f.dataProtocolo)))
    .filter((d) => Number.isFinite(d) && d >= 0);
  const leadTimeMedio = leadTimes.length
    ? Math.round(leadTimes.reduce((a, d) => a + d, 0) / leadTimes.length)
    : null;
  const proximoVencimento = own
    .map((f) => f.dataVencimento)
    .filter(Boolean)
    .sort()[0];

  const countdown = computeProtocolCountdown(patient, fulfillments);
  const lastReceived = fulfillments
    .filter((f) => f.patientId === patient.id && (f.status ?? "repasse_recebido") === "repasse_recebido")
    .sort((a, b) => b.dataDispensacao.localeCompare(a.dataDispensacao))[0];

  // Fallback: se não tem frascosPorMes, usa meses de fornecimento do estado
  let endFallback: string | null = null;
  let deadlineFallback: string | null = null;
  let daysMedFallback: number | null = null;
  let daysProtoFallback: number | null = null;
  if (!countdown.hasData && lastReceived && stateInfo) {
    const end = addMonths(parseISO(lastReceived.dataDispensacao), stateInfo.mesesFornecimento);
    endFallback = format(end, "yyyy-MM-dd");
    const deadline = new Date(end);
    deadline.setDate(deadline.getDate() - patient.alertaDias);
    deadlineFallback = format(deadline, "yyyy-MM-dd");
    daysMedFallback = differenceInCalendarDays(end, new Date());
    daysProtoFallback = differenceInCalendarDays(deadline, new Date());
  }

  const endDate = countdown.endDate ?? endFallback;
  const deadlineDate = countdown.deadline ?? deadlineFallback;
  const daysToEnd = countdown.hasData && countdown.endDate
    ? differenceInCalendarDays(parseISO(countdown.endDate), new Date())
    : daysMedFallback;
  const daysToProtocol = countdown.daysLeft ?? daysProtoFallback;
  const totalDuration = countdown.duracaoDias ?? (stateInfo ? stateInfo.mesesFornecimento * 30 : null);
  const elapsed = lastReceived && totalDuration
    ? Math.max(0, differenceInCalendarDays(new Date(), parseISO(lastReceived.dataDispensacao)))
    : null;
  const pctMed = elapsed != null && totalDuration
    ? Math.min(100, Math.round((elapsed / totalDuration) * 100))
    : 0;
  const protocolWindow = patient.alertaDias;
  const pctProto = totalDuration
    ? Math.min(100, Math.max(0, Math.round(((elapsed ?? 0) / Math.max(1, totalDuration - protocolWindow)) * 100)))
    : 0;

  return (
    <div className="space-y-6 p-8">
      <div>
        <Link to="/pacientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Pacientes
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{patient.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {patient.cpf} • {patient.estado}
            {stateInfo && ` — ${stateInfo.nome} (${stateInfo.mesesFornecimento} meses)`}
          </p>
          <div className="mt-2">
            <StatusBadge color={status.color} label={status.label} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm(`Excluir paciente "${patient.nome}" e todos os cumprimentos?`)) {
                own.forEach((f) => removeFul(f.id));
                remove(patient.id);
                toast.success("Paciente excluído");
                navigate({ to: "/pacientes" });
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Marca ativa</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={patient.brandId ?? ""}
              onValueChange={(v) => {
                upsert({ ...patient, brandId: v || null });
                toast.success("Marca atualizada");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {brand && (
              <p className="mt-2 text-xs text-muted-foreground">
                {brl(brand.precoFrasco)}/frasco • {brand.comissaoPct}%
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Frascos por pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{patient.frascosPorPedido}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Alerta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{patient.alertaDias} dias</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CRM — próxima janela de protocolo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!lastReceived ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nenhuma dispensação registrada ainda.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Última dispensação</p>
                  <p className="mt-1 font-medium">{formatDate(lastReceived.dataDispensacao)}</p>
                  <p className="text-xs text-muted-foreground">
                    {frascosTotal(lastReceived)} frascos
                    {patient.frascosPorMes ? ` • ${patient.frascosPorMes}/mês` : stateInfo ? ` • estado: ${stateInfo.mesesFornecimento}m` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Fim estimado do medicamento</p>
                  <p className="mt-1 font-medium">{endDate ? formatDate(endDate) : "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {daysToEnd != null ? (daysToEnd >= 0 ? `${daysToEnd} dias restantes` : `${Math.abs(daysToEnd)} dias atrás`) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Prazo p/ novo protocolo</p>
                  <p className="mt-1 font-medium">{deadlineDate ? formatDate(deadlineDate) : "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    antecedência de {patient.alertaDias}d
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Consumo do medicamento</span>
                  <span className="font-medium">
                    {daysToEnd != null && daysToEnd >= 0 ? `${daysToEnd}d p/ acabar` : daysToEnd != null ? `acabou há ${Math.abs(daysToEnd)}d` : "—"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${pctMed >= 100 ? "bg-red-500" : pctMed >= 75 ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${pctMed}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Janela para protocolar novo pedido</span>
                  <span className="font-medium">
                    {daysToProtocol != null
                      ? daysToProtocol > 0
                        ? `${daysToProtocol}d restantes`
                        : daysToProtocol === 0
                          ? "Protocolar hoje"
                          : `atrasado ${Math.abs(daysToProtocol)}d`
                      : "—"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${
                      daysToProtocol != null && daysToProtocol < 0
                        ? "bg-red-500"
                        : daysToProtocol != null && daysToProtocol <= 30
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                    }`}
                    style={{ width: `${pctProto}%` }}
                  />
                </div>
                {!patient.frascosPorMes && (
                  <p className="text-xs text-muted-foreground">
                    Dica: informe "frascos por mês" no cadastro do paciente para um cálculo preciso — usando fallback do estado.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Cumprimentos</p>
          <p className="mt-1 text-2xl font-semibold">{own.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Lead time médio</p>
          <p className="mt-1 text-2xl font-semibold">{leadTimeMedio != null ? `${leadTimeMedio}d` : "—"}</p>
          <p className="text-xs text-muted-foreground">protocolo → dispensação</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Próximo vencimento</p>
          <p className="mt-1 text-2xl font-semibold">{proximoVencimento ? formatDate(proximoVencimento) : "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Processos</p>
          <p className="mt-1 text-2xl font-semibold">{patientProcessos.length}</p>
          <p className="text-xs text-muted-foreground">{patientCumprimentos.length} cumprimento(s)</p>
        </CardContent></Card>
      </div>

      {patientProcessos.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Processos vinculados</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="pb-2">Nº CNJ</th>
                    <th className="pb-2">Tipo</th>
                    <th className="pb-2">Vara</th>
                    <th className="pb-2">Protocolo</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {patientProcessos.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{p.numeroCNJ}</td>
                      <td className="py-2">{p.tipo}</td>
                      <td className="py-2">{p.vara || "—"}</td>
                      <td className="py-2">{formatDate(p.dataProtocolo)}</td>
                      <td className="py-2">{p.status.replace("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Histórico de cumprimentos</CardTitle>
          <Button onClick={() => setFfOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo cumprimento
          </Button>
        </CardHeader>
        <CardContent>
          {own.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum cumprimento registrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="pb-2">Nº cumprimento</th>
                    <th className="pb-2">Protocolo</th>
                    <th className="pb-2">Dispensação</th>
                    <th className="pb-2 text-right">Lead time</th>
                    <th className="pb-2">Vencimento</th>
                    <th className="pb-2">Marca</th>
                    <th className="pb-2 text-right">Frascos</th>
                    <th className="pb-2 text-right">Valor</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {own.map((f) => {
                    const lead =
                      f.dataProtocolo && f.dataDispensacao
                        ? differenceInCalendarDays(parseISO(f.dataDispensacao), parseISO(f.dataProtocolo))
                        : null;
                    const step = funilStep(f.status);
                    return (
                    <tr key={f.id} className="border-b last:border-0 align-top">
                      <td className="py-3 font-mono text-xs">{f.numeroCumprimento || "—"}</td>
                      <td className="py-3">{formatDate(f.dataProtocolo)}</td>
                      <td className="py-3">{formatDate(f.dataDispensacao)}</td>
                      <td className="py-3 text-right">{lead != null && lead >= 0 ? `${lead}d` : "—"}</td>
                      <td className="py-3">{formatDate(f.dataVencimento)}</td>
                      <td className="py-3">{f.brandNomeSnapshot}</td>
                      <td className="py-3 text-right">{frascosTotal(f)}</td>
                      <td className="py-3 text-right">{brl(valorTotalEstado(f))}</td>
                      <td className="py-3 text-xs">{step.short}</td>
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Excluir cumprimento?")) {
                              removeFul(f.id);
                              toast.success("Excluído");
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                    );
                  })}
                  {own.some((f) => f.observacoes) && (
                    <tr>
                      <td colSpan={10} className="pt-4 text-xs text-muted-foreground">
                        Observações mais recentes:{" "}
                        {own.find((f) => f.observacoes)?.observacoes}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <FulfillmentForm open={ffOpen} onOpenChange={setFfOpen} patient={patient} />
      <PatientForm open={editOpen} onOpenChange={setEditOpen} editing={patient} />
    </div>
  );
}
