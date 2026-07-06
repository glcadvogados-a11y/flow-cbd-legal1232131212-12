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
import { useCollection, uid, type Receita } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";
import { addMonths, format, parseISO } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  editing?: Receita | null;
}

export function ReceitaForm({ open, onOpenChange, patientId, editing }: Props) {
  const { upsert } = useCollection("receitas");
  const [medico, setMedico] = useState("");
  const [dataEmissao, setDataEmissao] = useState(todayISO());
  const [dataValidade, setDataValidade] = useState(
    format(addMonths(new Date(), 6), "yyyy-MM-dd")
  );
  const [produtos, setProdutos] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setMedico(editing.medico);
      setDataEmissao(editing.dataEmissao);
      setDataValidade(editing.dataValidade);
      setProdutos(editing.produtosPrescritos);
      setArquivo(editing.arquivoNome ?? "");
      setObs(editing.observacoes ?? "");
    } else {
      setMedico("");
      setDataEmissao(todayISO());
      setDataValidade(format(addMonths(new Date(), 6), "yyyy-MM-dd"));
      setProdutos("");
      setArquivo("");
      setObs("");
    }
  }, [open, editing]);

  useEffect(() => {
    if (!editing && dataEmissao) {
      setDataValidade(format(addMonths(parseISO(dataEmissao), 6), "yyyy-MM-dd"));
    }
  }, [dataEmissao, editing]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!medico.trim()) {
      toast.error("Informe o médico");
      return;
    }
    upsert({
      id: editing?.id ?? uid(),
      patientId,
      medico: medico.trim(),
      dataEmissao,
      dataValidade,
      produtosPrescritos: produtos.trim(),
      arquivoNome: arquivo.trim() || undefined,
      observacoes: obs.trim() || undefined,
    });
    toast.success(editing ? "Receita atualizada" : "Receita registrada");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar receita" : "Nova receita"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Médico</Label>
            <Input value={medico} onChange={(e) => setMedico(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de emissão</Label>
              <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Validade</Label>
              <Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Produtos prescritos / posologia</Label>
            <Textarea value={produtos} onChange={(e) => setProdutos(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Nome do arquivo (opcional)</Label>
            <Input value={arquivo} onChange={(e) => setArquivo(e.target.value)} placeholder="receita-2026-01.pdf" />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
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