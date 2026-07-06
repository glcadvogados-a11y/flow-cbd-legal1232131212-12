import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCollection, uid, type Consulta } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  editing?: Consulta | null;
}

export function ConsultaForm({ open, onOpenChange, patientId, editing }: Props) {
  const { upsert } = useCollection("consultas");
  const [data, setData] = useState(todayISO());
  const [medico, setMedico] = useState("");
  const [valor, setValor] = useState("0");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setData(editing.data);
      setMedico(editing.medico);
      setValor(String(editing.valor));
      setObs(editing.observacoes ?? "");
    } else {
      setData(todayISO());
      setMedico("");
      setValor("0");
      setObs("");
    }
  }, [open, editing]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!medico.trim()) {
      toast.error("Informe o médico");
      return;
    }
    upsert({
      id: editing?.id ?? uid(),
      patientId,
      data,
      medico: medico.trim(),
      valor: parseFloat(valor.replace(",", ".")) || 0,
      observacoes: obs.trim() || undefined,
    });
    toast.success(editing ? "Consulta atualizada" : "Consulta registrada");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar consulta" : "Nova consulta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Médico</Label>
            <Input value={medico} onChange={(e) => setMedico(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}