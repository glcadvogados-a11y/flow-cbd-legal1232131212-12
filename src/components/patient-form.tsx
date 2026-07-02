import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCollection, uid, seedStatesIfEmpty, type Patient } from "@/lib/db";
import { maskCPF } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Patient | null;
}

export function PatientForm({ open, onOpenChange, editing }: Props) {
  const { items: brands } = useCollection("brands");
  const { items: states } = useCollection("states");
  const { upsert } = useCollection("patients");

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [estado, setEstado] = useState<string>("");
  const [brandId, setBrandId] = useState<string>("");
  const [frascos, setFrascos] = useState<string>("1");
  const [alerta, setAlerta] = useState<string>("90");

  useEffect(() => {
    seedStatesIfEmpty();
  }, []);

  useEffect(() => {
    if (editing) {
      setNome(editing.nome);
      setCpf(editing.cpf);
      setEstado(editing.estado);
      setBrandId(editing.brandId ?? "");
      setFrascos(String(editing.frascosPorPedido));
      setAlerta(String(editing.alertaDias));
    } else {
      setNome("");
      setCpf("");
      setEstado(states[0]?.sigla ?? "");
      setBrandId("");
      setFrascos("1");
      setAlerta("90");
    }
  }, [editing, open, states]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !cpf.trim()) {
      toast.error("Preencha nome e CPF");
      return;
    }
    if (!estado) {
      toast.error("Selecione um estado");
      return;
    }
    const p: Patient = {
      id: editing?.id ?? uid(),
      nome: nome.trim(),
      cpf,
      estado,
      brandId: brandId || null,
      frascosPorPedido: Math.max(1, parseInt(frascos, 10) || 1),
      alertaDias: Math.max(1, parseInt(alerta, 10) || 90),
      criadoEm: editing?.criadoEm ?? new Date().toISOString(),
    };
    upsert(p);
    toast.success(editing ? "Paciente atualizado" : "Paciente cadastrado");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar paciente" : "Novo paciente"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {states.length === 0 && (
                    <SelectItem value="__none" disabled>
                      Cadastre um estado primeiro
                    </SelectItem>
                  )}
                  {states.map((s) => (
                    <SelectItem key={s.id} value={s.sigla}>
                      {s.sigla} — {s.nome} ({s.mesesFornecimento} meses)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Marca ativa</Label>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma marca" />
              </SelectTrigger>
              <SelectContent>
                {brands.length === 0 && (
                  <SelectItem value="__none" disabled>
                    Cadastre uma marca primeiro
                  </SelectItem>
                )}
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frascos por pedido</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={frascos}
                onChange={(e) => setFrascos(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label>Alertar antes de vencer</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={alerta}
                onChange={(e) => setAlerta(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="90"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
