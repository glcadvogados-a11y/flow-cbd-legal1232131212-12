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
import { useCollection, type Processo } from "@/lib/db";
import { ProcessoForm } from "@/components/processo-form";
import { CumprimentoForm } from "@/components/cumprimento-form";
import { formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/processos")({
  component: ProcessosPage,
});

const STATUS_LABEL: Record<string, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  suspenso: "Suspenso",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function ProcessosPage() {
  const { items: processos, remove } = useCollection("processos");
  const { items: cumprimentos, remove: removeCump } = useCollection("cumprimentos");
  const { items: patients } = useCollection("patients");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [patientId, setPatientId] = useState<string>("");
  const [procOpen, setProcOpen] = useState(false);
  const [procEditing, setProcEditing] = useState<Processo | null>(null);
  const [cumpOpen, setCumpOpen] = useState(false);
  const [cumpProcId, setCumpProcId] = useState("");

  const patientName = (id: string) => patients.find((p) => p.id === id)?.nome ?? "—";

  const normalize = (s: string) =>
    s === "concluido" || s === "suspenso" ? s : "em_andamento";

  const filtered = processos.filter(
    (p) => statusFilter === "all" || normalize(p.status) === statusFilter
  );

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

      <div className="space-y-3">
        {filtered.map((proc) => {
          const cumps = cumprimentos.filter((c) => c.processoId === proc.id);
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
                    <Button size="sm" variant="outline" onClick={() => { setCumpProcId(proc.id); setCumpOpen(true); }}>
                      <Plus className="mr-1 h-4 w-4" /> Cumprimento
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setProcEditing(proc); setPatientId(proc.patientId); setProcOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (cumps.length > 0) { toast.error("Remova os cumprimentos primeiro"); return; }
                      if (confirm(`Excluir processo ${proc.numeroCNJ}?`)) { remove(proc.id); toast.success("Excluído"); }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {cumps.length > 0 && (
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
                                if (confirm(`Excluir cumprimento ${c.numero}?`)) { removeCump(c.id); toast.success("Excluído"); }
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
        <CumprimentoForm open={cumpOpen} onOpenChange={setCumpOpen} processoId={cumpProcId} />
      )}
    </div>
  );
}