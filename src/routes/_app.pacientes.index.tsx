import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useCollection, type Patient } from "@/lib/db";
import { computeStatus, computeProtocolCountdown } from "@/lib/domain";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { PatientForm } from "@/components/patient-form";
import { Plus, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/pacientes/")({
  component: PacientesList,
});

function PacientesList() {
  const { items: patients } = useCollection("patients");
  const { items: fulfillments } = useCollection("fulfillments");
  const { items: brands } = useCollection("brands");
  const { items: states } = useCollection("states");
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "red" | "yellow" | "green" | "gray">(
    "all"
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return patients
      .map((p) => ({
        p,
        s: computeStatus(p, fulfillments),
        c: computeProtocolCountdown(p, fulfillments),
      }))
      .filter(({ p, s }) => {
        if (estado !== "all" && p.estado !== estado) return false;
        if (status !== "all" && s.color !== status) return false;
        if (
          q &&
          !p.nome.toLowerCase().includes(q) &&
          !p.cpf.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        const av = a.c.daysLeft ?? Number.POSITIVE_INFINITY;
        const bv = b.c.daysLeft ?? Number.POSITIVE_INFINITY;
        return av - bv;
      });
  }, [patients, fulfillments, search, estado, status]);

  const brandName = (id: string | null) =>
    brands.find((b) => b.id === id)?.nome ?? "—";

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">
            {patients.length} paciente(s) cadastrado(s)
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo paciente
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              placeholder="Buscar por nome ou CPF"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {states.map((s) => (
                  <SelectItem key={s.id} value={s.sigla}>
                    {s.sigla}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="red">Vencido</SelectItem>
                <SelectItem value="yellow">Em alerta</SelectItem>
                <SelectItem value="green">Em dia</SelectItem>
                <SelectItem value="gray">Sem cumprimentos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="p-4">Nome</th>
                  <th className="p-4">CPF</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Marca</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Próx. protocolo</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Nenhum paciente encontrado.
                    </td>
                  </tr>
                )}
                {filtered.map(({ p, s, c }) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-4 font-medium">
                      <Link to="/pacientes/$id" params={{ id: p.id }} className="hover:underline">
                        {p.nome}
                      </Link>
                    </td>
                    <td className="p-4">{p.cpf}</td>
                    <td className="p-4">{p.estado}</td>
                    <td className="p-4">{brandName(p.brandId)}</td>
                    <td className="p-4">
                      <StatusBadge color={s.color} label={s.label} />
                    </td>
                    <td className="p-4">
                      {c.hasData ? (
                        <div className="space-y-1">
                          <StatusBadge color={c.color} label={c.label} />
                          {c.deadline && (
                            <div className="text-xs text-muted-foreground">
                              até {formatDate(c.deadline)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{c.label}</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(p);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PatientForm open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}
