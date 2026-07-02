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
import { computeStatus } from "@/lib/domain";
import { StatusBadge } from "@/components/status-badge";
import { FulfillmentForm } from "@/components/fulfillment-form";
import { PatientForm } from "@/components/patient-form";
import { brl, formatDate } from "@/lib/format";
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
    .sort((a, b) => b.dataDispensacao.localeCompare(a.dataDispensacao));
  const status = computeStatus(patient, fulfillments);
  const brand = brands.find((b) => b.id === patient.brandId);
  const stateInfo = states.find((s) => s.sigla === patient.estado);

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
                    <th className="pb-2">Vencimento</th>
                    <th className="pb-2">Marca</th>
                    <th className="pb-2 text-right">Frascos</th>
                    <th className="pb-2 text-right">Valor</th>
                    <th className="pb-2 text-right">Comissão</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {own.map((f) => (
                    <tr key={f.id} className="border-b last:border-0 align-top">
                      <td className="py-3 font-mono text-xs">{f.numeroCumprimento || "—"}</td>
                      <td className="py-3">{formatDate(f.dataProtocolo)}</td>
                      <td className="py-3">{formatDate(f.dataDispensacao)}</td>
                      <td className="py-3">{formatDate(f.dataVencimento)}</td>
                      <td className="py-3">{f.brandNomeSnapshot}</td>
                      <td className="py-3 text-right">{f.frascos}</td>
                      <td className="py-3 text-right">{brl(f.valorRecebido)}</td>
                      <td className="py-3 text-right">
                        {brl(f.comissaoValorSnapshot * f.frascos)}
                      </td>
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
                  ))}
                  {own.some((f) => f.observacoes) && (
                    <tr>
                      <td colSpan={9} className="pt-4 text-xs text-muted-foreground">
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
