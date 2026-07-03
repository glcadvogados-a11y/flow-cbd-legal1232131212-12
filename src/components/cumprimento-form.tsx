import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCollection,
  uid,
  type Cumprimento,
  type CumprimentoStatus,
} from "@/lib/db";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  processoId: string;
  editing?: Cumprimento | null;
}

export function CumprimentoForm({ open, onOpenChange, processoId, editing }: Props) {
  const { upsert } = useCollection("cumprimentos");
  const [numero, setNumero] = useState("");
  const [dataProtocolo, setDataProtocolo] = useState(todayISO());
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [status, setStatus] = useState<CumprimentoStatus>("em_andamento");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNumero(editing.numero);
      setDataProtocolo(editing.dataProtocolo);
      setPeriodoInicio(editing.periodoInicio ?? "");
      setPeriodoFim(editing.periodoFim ?? "");
      setStatus(editing.status);
      setObservacoes(editing.observacoes ?? "");
    } else {
      setNumero("");
      setDataProtocolo(todayISO());
      setPeriodoInicio("");
      setPeriodoFim("");
      setStatus("em_andamento");
      setObservacoes("");
    }
  }, [open, editing]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!numero.trim()) {
      toast.error("Informe o número do cumprimento");
      return;
    }
    upsert({
      id: editing?.id ?? uid(),
      processoId,
      numero: numero.trim(),
      dataProtocolo,
      periodoInicio: periodoInicio || undefined,
      periodoFim: periodoFim || undefined,
      status,
      observacoes: observacoes.trim() || undefined,
    });
    toast.success(editing ? "Cumprimento atualizado" : "Cumprimento cadastrado");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cumprimento" : "Novo cumprimento de sentença"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Data protocolo</Label>
              <Input type="date" value={dataProtocolo} onChange={(e) => setDataProtocolo(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Início do período</Label>
              <Input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim do período</Label>
              <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CumprimentoStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
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