import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollection, type Cumprimento } from "@/lib/db";
import {
  computeStatus,
  computeProtocolCountdown,
  funilStep,
  valorTotalEstado,
  frascosTotal,
  comissaoTotal,
  isRealized,
  isProjected,
} from "@/lib/domain";
import { StatusBadge } from "@/components/status-badge";
import { FulfillmentForm } from "@/components/fulfillment-form";
import { PatientForm } from "@/components/patient-form";
import { CumprimentoForm } from "@/components/cumprimento-form";
import { ConsultaForm } from "@/components/consulta-form";
import { ReceitaForm } from "@/components/receita-form";
import { brl, formatDate } from "@/lib/format";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Package,
  Gavel,
  Stethoscope,
  FileText,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pacientes/$id")({
  component: PatientDetail,
});

type TimelineEvent = {
  id: string;
  date: string;
  kind: "fulfillment" | "cumprimento" | "processo" | "consulta" | "receita";
  title: string;
  detail?: string;
  meta?: string;
};

function PatientDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { items: patients, remove } = useCollection("patients");
  const { items: fulfillments, remove: removeFul } = useCollection("fulfillments");
  const { items: brands } = useCollection("brands");
  const { items: states } = useCollection("states");
  const { items: processos } = useCollection("processos");
  const { items: cumprimentos } = useCollection("cumprimentos");
  const { items: consultas, remove: removeConsulta } = useCollection("consultas");
  const { items: receitas, remove: removeReceita } = useCollection("receitas");
  const { items: products } = useCollection("products");

  const [ffOpen, setFfOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [consultaOpen, setConsultaOpen] = useState(false);
  const [receitaOpen, setReceitaOpen] = useState(false);
  const [cumpOpen, setCumpOpen] = useState(false);
  const [cumpProcId, setCumpProcId] = useState("");
  const [cumpEditing, setCumpEditing] = useState<Cumprimento | null>(null);
  const [tlFilter, setTlFilter] = useState<TimelineEvent["kind"] | "all">("all");

  const patient = patients.find((p) => p.id === id);

  if (!patient) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Paciente não encontrado.</p>
        <Link to="/pacientes">
          <Button variant="outline" className="mt-4">Voltar</Button>
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
  const countdown = computeProtocolCountdown(patient, fulfillments);

  const patientProcessos = processos.filter((p) => p.patientId === patient.id);
  const patientProcIds = new Set(patientProcessos.map((p) => p.id));
  const patientCumprimentos = cumprimentos.filter((c) => patientProcIds.has(c.processoId));
  const patientConsultas = consultas.filter((c) => c.patientId === patient.id);
  const patientReceitas = receitas.filter((r) => r.patientId === patient.id);

  const totalRecebido = own.filter(isRealized).reduce((a, f) => a + valorTotalEstado(f), 0);
  const totalProjetado = own.filter(isProjected).reduce((a, f) => a + valorTotalEstado(f), 0);
  const totalComissao = own.filter(isRealized).reduce((a, f) => a + comissaoTotal(f), 0);
  const patientProductNames = (patient.produtos ?? [])
    .map((pp) => {
      const p = products.find((x) => x.id === pp.productId);
      const b = brands.find((br) => br.id === p?.brandId);
      return p ? `${b?.nome ?? "?"} ${p.tipo}${p.concentracaoMg ? ` ${p.concentracaoMg}mg` : ""} × ${pp.frascos}` : null;
    })
    .filter(Boolean) as string[];

  // Reminders
  const reminders: { color: "red" | "yellow" | "green" | "gray"; text: string }[] = [];
  if (countdown.hasData && countdown.daysLeft != null) {
    if (countdown.daysLeft < 0) reminders.push({ color: "red", text: `Protocolo atrasado há ${Math.abs(countdown.daysLeft)}d` });
    else if (countdown.daysLeft <= 30) reminders.push({ color: "yellow", text: `Protocolar novo pedido em ${countdown.daysLeft}d` });
  }
  patientReceitas.forEach((r) => {
    const d = differenceInCalendarDays(parseISO(r.dataValidade), new Date());
    if (d < 0) reminders.push({ color: "red", text: `Receita de ${r.medico} venceu há ${Math.abs(d)}d` });
    else if (d <= 60) reminders.push({ color: "yellow", text: `Receita de ${r.medico} vence em ${d}d` });
  });
  patientCumprimentos
    .filter((c) => c.status === "em_andamento")
    .forEach((c) => reminders.push({ color: "yellow", text: `Cumprimento ${c.numero} em andamento` }));
  if (reminders.length === 0) reminders.push({ color: "green", text: "Sem pendências no momento" });

  // Unified timeline
  const timeline: TimelineEvent[] = useMemo(() => {
    if (!patient) return [];
    const events: TimelineEvent[] = [];
    own.forEach((f) => {
      events.push({
        id: `f-${f.id}`,
        date: f.dataProtocolo || f.dataDispensacao,
        kind: "fulfillment",
        title: `Dispensação #${f.numeroCumprimento || "—"}`,
        detail: `${frascosTotal(f)} frascos • ${f.brandNomeSnapshot}`,
        meta: `${brl(valorTotalEstado(f))} • ${funilStep(f.status).short}`,
      });
    });
    patientProcessos.forEach((p) => {
      events.push({
        id: `p-${p.id}`,
        date: p.dataProtocolo,
        kind: "processo",
        title: `Processo ${p.tipo} — ${p.numeroCNJ}`,
        detail: p.vara,
        meta: p.status,
      });
    });
    patientCumprimentos.forEach((c) => {
      const proc = patientProcessos.find((pp) => pp.id === c.processoId);
      events.push({
        id: `c-${c.id}`,
        date: c.dataProtocolo,
        kind: "cumprimento",
        title: `Cumprimento ${c.numero}`,
        detail: proc ? `Processo ${proc.numeroCNJ}` : undefined,
        meta: c.status,
      });
    });
    patientConsultas.forEach((c) => {
      events.push({
        id: `co-${c.id}`,
        date: c.data,
        kind: "consulta",
        title: `Consulta — ${c.medico}`,
        detail: c.observacoes,
        meta: c.valor > 0 ? brl(c.valor) : undefined,
      });
    });
    patientReceitas.forEach((r) => {
      events.push({
        id: `r-${r.id}`,
        date: r.dataEmissao,
        kind: "receita",
        title: `Receita — ${r.medico}`,
        detail: r.produtosPrescritos,
        meta: `válida até ${formatDate(r.dataValidade)}`,
      });
    });
    return events.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [patient, own, patientProcessos, patientCumprimentos, patientConsultas, patientReceitas]);

  const tlFiltered = timeline.filter((e) => tlFilter === "all" || e.kind === tlFilter);

  const kindStyle: Record<TimelineEvent["kind"], { icon: React.ElementType; color: string }> = {
    fulfillment: { icon: Package, color: "bg-blue-500" },
    processo: { icon: Gavel, color: "bg-purple-500" },
    cumprimento: { icon: Gavel, color: "bg-indigo-500" },
    consulta: { icon: Stethoscope, color: "bg-teal-500" },
    receita: { icon: FileText, color: "bg-amber-500" },
  };
  const kindLabel: Record<TimelineEvent["kind"], string> = {
    fulfillment: "Dispensações",
    processo: "Processos",
    cumprimento: "Cumprimentos",
    consulta: "Consultas",
    receita: "Receitas",
  };

  return (
    <div className="space-y-6 p-8">
      <div>
        <Link to="/pacientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Pacientes
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">{patient.nome}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{patient.cpf}</span>
            <span>•</span>
            <span>
              {patient.estado}
              {stateInfo && ` — ${stateInfo.nome} (${stateInfo.mesesFornecimento} meses)`}
            </span>
            {brand && <><span>•</span><span>Marca: {brand.nome}</span></>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge color={status.color} label={status.label} />
            {patient.frascosPorMes && (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs">
                {patient.frascosPorMes} frascos/mês
              </span>
            )}
            {patientProductNames.map((n, i) => (
              <span key={i} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs">
                {n}
              </span>
            ))}
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

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setFfOpen(true)}>
          <Package className="mr-2 h-4 w-4" /> Nova dispensação
        </Button>
        <Button
          variant="outline"
          disabled={patientProcessos.length === 0}
          onClick={() => {
            setCumpEditing(null);
            setCumpProcId(patientProcessos[0]?.id ?? "");
            setCumpOpen(true);
          }}
        >
          <Gavel className="mr-2 h-4 w-4" /> Novo cumprimento judicial
        </Button>
        <Button variant="outline" onClick={() => setConsultaOpen(true)}>
          <Stethoscope className="mr-2 h-4 w-4" /> Nova consulta
        </Button>
        <Button variant="outline" onClick={() => setReceitaOpen(true)}>
          <FileText className="mr-2 h-4 w-4" /> Nova receita
        </Button>
      </div>

      {patientProcessos.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Cadastre um processo na aba <Link to="/processos" className="underline">Processos</Link> para habilitar cumprimentos judiciais.
        </p>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* CRM protocol countdown */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">CRM — próxima janela de protocolo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!countdown.hasData ? (
              <p className="text-sm text-muted-foreground">
                {own.length === 0
                  ? "Nenhuma dispensação registrada."
                  : "Informe 'frascos por mês' no cadastro do paciente para calcular."}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Fim do medicamento</p>
                    <p className="font-medium">{countdown.endDate ? formatDate(countdown.endDate) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Prazo p/ protocolo</p>
                    <p className="font-medium">{countdown.deadline ? formatDate(countdown.deadline) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Restante</p>
                    <StatusBadge color={countdown.color} label={countdown.label} />
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${countdown.color === "red" ? "bg-red-500" : countdown.color === "yellow" ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{
                      width: `${
                        countdown.duracaoDias
                          ? Math.min(100, Math.max(2, Math.round((1 - Math.max(0, countdown.daysLeft ?? 0) / countdown.duracaoDias) * 100)))
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Reminders */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Próximas ações</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {reminders.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertCircle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      r.color === "red" ? "text-red-500" : r.color === "yellow" ? "text-yellow-500" : "text-green-600"
                    }`}
                  />
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Dispensações</p>
          <p className="mt-1 text-2xl font-semibold">{own.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Recebido</p>
          <p className="mt-1 text-2xl font-semibold">{brl(totalRecebido)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Projetado</p>
          <p className="mt-1 text-2xl font-semibold">{brl(totalProjetado)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Comissão</p>
          <p className="mt-1 text-2xl font-semibold">{brl(totalComissao)}</p>
        </CardContent></Card>
      </div>

      {/* Unified timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Linha do tempo</CardTitle>
          <div className="flex flex-wrap gap-1">
            <FilterChip active={tlFilter === "all"} onClick={() => setTlFilter("all")}>Tudo</FilterChip>
            {(Object.keys(kindLabel) as TimelineEvent["kind"][]).map((k) => (
              <FilterChip key={k} active={tlFilter === k} onClick={() => setTlFilter(k)}>
                {kindLabel[k]}
              </FilterChip>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {tlFiltered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento.</p>
          ) : (
            <ol className="relative space-y-4 border-l pl-6">
              {tlFiltered.map((e) => {
                const { icon: Icon, color } = kindStyle[e.kind];
                return (
                  <li key={e.id} className="relative">
                    <span className={`absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full ${color} text-white`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{e.title}</p>
                      <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                    </div>
                    {e.detail && <p className="text-sm text-muted-foreground">{e.detail}</p>}
                    {e.meta && <p className="text-xs text-muted-foreground">{e.meta}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Detailed tables kept collapsed below for quick management */}
      <Card>
        <CardHeader><CardTitle>Consultas ({patientConsultas.length})</CardTitle></CardHeader>
        <CardContent>
          {patientConsultas.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma consulta.</p>
          ) : (
            <div className="divide-y">
              {patientConsultas
                .slice()
                .sort((a, b) => b.data.localeCompare(a.data))
                .map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{c.medico}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(c.data)} • {brl(c.valor)}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm("Excluir consulta?")) { removeConsulta(c.id); toast.success("Excluída"); }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Receitas ({patientReceitas.length})</CardTitle></CardHeader>
        <CardContent>
          {patientReceitas.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma receita.</p>
          ) : (
            <div className="divide-y">
              {patientReceitas
                .slice()
                .sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao))
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{r.medico}</p>
                      <p className="text-xs text-muted-foreground">
                        Emitida {formatDate(r.dataEmissao)} • válida até {formatDate(r.dataValidade)}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm("Excluir receita?")) { removeReceita(r.id); toast.success("Excluída"); }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FulfillmentForm open={ffOpen} onOpenChange={setFfOpen} patient={patient} />
      <PatientForm open={editOpen} onOpenChange={setEditOpen} editing={patient} />
      <ConsultaForm open={consultaOpen} onOpenChange={setConsultaOpen} patientId={patient.id} />
      <ReceitaForm open={receitaOpen} onOpenChange={setReceitaOpen} patientId={patient.id} />
      {cumpProcId && (
        <CumprimentoForm open={cumpOpen} onOpenChange={setCumpOpen} processoId={cumpProcId} editing={cumpEditing} />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}