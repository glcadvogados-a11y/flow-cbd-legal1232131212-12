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
import { useCollection, uid, type Processo, type ProcessoStatus } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  editing?: Processo | null;
}

export function ProcessoForm({ open, onOpenChange, patientId, editing }: Props) {
  const { upsert } = useCollection("processos");
  const [numeroCNJ, setNumeroCNJ] = useState("");
  const [tipo, setTipo] = useState<"liminar" | "merito">("liminar");
  const [vara, setVara] = useState("");
  const [dataProtocolo, setDataProtocolo] = useState(todayISO());
  const [dataDecisao, setDataDecisao] = useState("");
  const [status, setStatus] = useState<ProcessoStatus>("em_andamento");
  const [objeto, setObjeto] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNumeroCNJ(editing.numeroCNJ);
      setTipo(editing.tipo);
      setVara(editing.vara);
      setDataProtocolo(editing.dataProtocolo);
      setDataDecisao(editing.dataDecisao ?? "");
      setStatus(editing.status);
      setObjeto(editing.objeto);
    } else {
      setNumeroCNJ("");
      setTipo("liminar");
      setVara("");
      setDataProtocolo(todayISO());
      setDataDecisao("");
      setStatus("em_andamento");
      setObjeto("");
    }
  }, [open, editing]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!numeroCNJ.trim()) {
      toast.error("Informe o número CNJ");
      return;
    }
    upsert({
      id: editing?.id ?? uid(),
      patientId,
      numeroCNJ: numeroCNJ.trim(),
      tipo,
      vara: vara.trim(),
      dataProtocolo,
      dataDecisao: dataDecisao || undefined,
      status,
      objeto: objeto.trim(),
      criadoEm: editing?.criadoEm ?? new Date().toISOString(),
    });
    toast.success(editing ? "Processo atualizado" : "Processo cadastrado");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar processo" : "Novo processo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Número CNJ</Label>
            <Input
              value={numeroCNJ}
              onChange={(e) => setNumeroCNJ(e.target.value)}
              placeholder="0000000-00.0000.0.00.0000"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="liminar">Liminar</SelectItem>
                  <SelectItem value="merito">Mérito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProcessoStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="li_emitida">L.I. Emitida</SelectItem>
                  <SelectItem value="desembaraco">Desembaraço</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Vara / Comarca</Label>
            <Input value={vara} onChange={(e) => setVara(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data do protocolo</Label>
              <Input type="date" value={dataProtocolo} onChange={(e) => setDataProtocolo(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Data da decisão</Label>
              <Input type="date" value={dataDecisao} onChange={(e) => setDataDecisao(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Objeto / o que a decisão obriga</Label>
            <Textarea value={objeto} onChange={(e) => setObjeto(e.target.value)} rows={3} />
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