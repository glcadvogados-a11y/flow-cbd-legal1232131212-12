import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCollection, type Processo, type Cumprimento } from "@/lib/db";
import { ProcessoForm } from "@/components/processo-form";
import { CumprimentoForm } from "@/components/cumprimento-form";
import { formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/processos")({
  component: ProcessosPage,
});

const STATUS_LABEL: Record<string, string> = {
  em_andamento: "Em andamento",
  invoice: "Invoice",
  li_emitida: "L.I. Emitida",
  desembaraco: "Desembaraço",
  concluido: "Concluído",
  suspenso: "Suspenso",
  cancelado: "Cancelado",
};

function StatusKpi({
  label,
  value,
  barClass,
  total,
}: {
  label: string;
  value: number;
  barClass: string;
  total: number;
}) {
  const pct = total > 0 ? Math.max(6, Math.round((value / total) * 100)) : 0;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProcessosPage() {
  const { items: processos, remove } = useCollection("processos");
  const { items: cumprimentos, remove: removeCump } = useCollection("cumprimentos");
  const { items: patients } = useCollection("patients");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("paciente_az");
  const [patientId, setPatientId] = useState<string>("");
  const [procOpen, setProcOpen] = useState(false);
  const [procEditing, setProcEditing] = useState<Processo | null>(null);
  const [cumpOpen, setCumpOpen] = useState(false);
  const [cumpProcId, setCumpProcId] = useState("");
  const [cumpEditing, setCumpEditing] = useState<Cumprimento | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const patientName = (id: string) => patients.find((p) => p.id === id)?.nome ?? "—";

  const normalize = (s: string) =>
    s === "concluido" || s === "suspenso" ? s : "em_andamento";

  const filtered = processos.filter(
    (p) => statusFilter === "all" || normalize(p.status) === statusFilter
  );
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "paciente_az":
        return patientName(a.patientId).localeCompare(patientName(b.patientId), "pt-BR");
      case "paciente_za":
        return patientName(b.patientId).localeCompare(patientName(a.patientId), "pt-BR");
      case "protocolo_desc":
        return (b.dataProtocolo ?? "").localeCompare(a.dataProtocolo ?? "");
      case "protocolo_asc":
        return (a.dataProtocolo ?? "").localeCompare(b.dataProtocolo ?? "");
      case "status":
        return normalize(a.status).localeCompare(normalize(b.status));
      default:
        return 0;
    }
  });
  const allExpanded = filtered.length > 0 && filtered.every((p) => expanded[p.id]);
  const setAll = (v: boolean) => {
    const next: Record<string, boolean> = {};
    for (const p of filtered) next[p.id] = v;
    setExpanded(next);
  };

  const counts = {
    em_andamento: processos.filter((p) => normalize(p.status) === "em_andamento").length,
    concluido: processos.filter((p) => normalize(p.status) === "concluido").length,
    suspenso: processos.filter((p) => normalize(p.status) === "suspenso").length,
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Processos</h1>
          <p className="text-sm text-muted-foreground">
            {processos.length} processo(s) — controle de status e situação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="paciente_az">Paciente (A→Z)</SelectItem>
              <SelectItem value="paciente_za">Paciente (Z→A)</SelectItem>
              <SelectItem value="protocolo_desc">Protocolo (mais recente)</SelectItem>
              <SelectItem value="protocolo_asc">Protocolo (mais antigo)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
            </SelectContent>
          </Select>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Paciente para novo processo" /></SelectTrigger>
            <SelectContent>
              {patients.length === 0 && (
                <SelectItem value="__none" disabled>Cadastre um paciente</SelectItem>
              )}
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!patientId}
            onClick={() => {
              setProcEditing(null);
              setProcOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo processo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatusKpi label="Em andamento" value={counts.em_andamento} barClass="bg-blue-500" total={processos.length} />
        <StatusKpi label="Concluído" value={counts.concluido} barClass="bg-green-500" total={processos.length} />
        <StatusKpi label="Suspenso" value={counts.suspenso} barClass="bg-muted-foreground/50" total={processos.length} />
      </div>

      {filtered.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum processo.</CardContent></Card>
      )}

      {filtered.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setAll(!allExpanded)}>
            {allExpanded ? "Fechar todos os cumprimentos" : "Abrir todos os cumprimentos"}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((proc) => {
          const cumps = cumprimentos
            .filter((c) => c.processoId === proc.id)
            .sort((a, b) =>
              (b.dataProtocolo ?? "").localeCompare(a.dataProtocolo ?? ""),
            );
          const isOpen = expanded[proc.id] ?? false;
          return (
            <Card key={proc.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{proc.numeroCNJ}</span>
                      <span className="rounded-full border px-2 py-0.5 text-xs">{proc.tipo}</span>
                      <span className="rounded-full border px-2 py-0.5 text-xs">{STATUS_LABEL[proc.status] ?? proc.status}</span>
                    </div>
                    <div className="mt-1 text-sm">
                      <Link to="/pacientes/$id" params={{ id: proc.patientId }} className="font-medium hover:underline">
                        {patientName(proc.patientId)}
                      </Link>
                      {proc.vara && <span className="text-muted-foreground"> • {proc.vara}</span>}
                      <span className="text-muted-foreground"> • Protocolo {formatDate(proc.dataProtocolo)}</span>
                    </div>
                    {proc.objeto && (
                      <p className="mt-1 text-xs text-muted-foreground">{proc.objeto}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {cumps.length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => toggle(proc.id)}>
                        {isOpen ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
                        {cumps.length} cumprimento(s)
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => { setCumpProcId(proc.id); setCumpEditing(null); setCumpOpen(true); }}>
                      <Plus className="mr-1 h-4 w-4" /> Cumprimento
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setProcEditing(proc); setPatientId(proc.patientId); setProcOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      const suffix = cumps.length > 0 ? " e todos os cumprimentos/fornecimentos vinculados" : "";
                      if (confirm(`Excluir processo ${proc.numeroCNJ}${suffix}?`)) { remove(proc.id); toast.success("Excluído"); }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {cumps.length > 0 && isOpen && (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground bg-muted/40">
                        <tr>
                          <th className="p-2">Nº cumprimento</th>
                          <th className="p-2">Protocolo</th>
                          <th className="p-2">Período</th>
                          <th className="p-2">Status</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cumps.map((c) => (
                          <tr key={c.id} className="border-t">
                            <td className="p-2 font-mono text-xs">{c.numero}</td>
                            <td className="p-2">{formatDate(c.dataProtocolo)}</td>
                            <td className="p-2 text-xs">
                              {c.periodoInicio ? formatDate(c.periodoInicio) : "—"} → {c.periodoFim ? formatDate(c.periodoFim) : "—"}
                            </td>
                            <td className="p-2">{STATUS_LABEL[c.status] ?? c.status}</td>
                            <td className="p-2 text-right">
                              <Button size="sm" variant="ghost" onClick={() => {
                                setCumpProcId(c.processoId); setCumpEditing(c); setCumpOpen(true);
                              }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => {
                                if (confirm(`Excluir cumprimento ${c.numero}?`)) {
                                  removeCump(c.id);
                                  toast.success("Excluído");
                                }
                              }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {patientId && (
        <ProcessoForm open={procOpen} onOpenChange={setProcOpen} patientId={patientId} editing={procEditing} />
      )}
      {cumpProcId && (
        <CumprimentoForm open={cumpOpen} onOpenChange={setCumpOpen} processoId={cumpProcId} editing={cumpEditing} />
      )}
    </div>
  );
}