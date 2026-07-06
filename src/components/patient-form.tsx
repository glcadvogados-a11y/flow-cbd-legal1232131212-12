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
import {
  useCollection,
  uid,
  seedStatesIfEmpty,
  type Patient,
  type PatientStatusManual,
  type PatientProduto,
} from "@/lib/db";
import { maskCPF } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Patient | null;
}

export function PatientForm({ open, onOpenChange, editing }: Props) {
  const { items: brands } = useCollection("brands");
  const { items: products } = useCollection("products");
  const { items: states } = useCollection("states");
  const { upsert } = useCollection("patients");

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [estado, setEstado] = useState<string>("");
  const [brandId, setBrandId] = useState<string>("");
  const [frascos, setFrascos] = useState<string>("1");
  const [alerta, setAlerta] = useState<string>("90");
  const [statusManual, setStatusManual] = useState<PatientStatusManual>("auto");
  const [produtos, setProdutos] = useState<PatientProduto[]>([]);

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
      setStatusManual(editing.statusManual ?? "auto");
      setProdutos(editing.produtos ?? []);
    } else {
      setNome("");
      setCpf("");
      setEstado(states[0]?.sigla ?? "");
      setBrandId("");
      setFrascos("1");
      setAlerta("90");
      setStatusManual("auto");
      setProdutos([]);
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
      statusManual,
      produtos: produtos.filter((x) => x.productId && x.frascos > 0),
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
          <div className="space-y-2">
            <Label>Alertar antes de vencer (dias)</Label>
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
          <div className="space-y-2">
            <Label>Status do paciente</Label>
            <Select value={statusManual} onValueChange={(v) => setStatusManual(v as PatientStatusManual)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (pelos cumprimentos)</SelectItem>
                <SelectItem value="aguardando">Aguardando cumprimento</SelectItem>
                <SelectItem value="cumprido">Cumprido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Produtos que recebe</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setProdutos((prev) => [...prev, { productId: "", frascos: 1 }])
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Adicionar produto
              </Button>
            </div>
            {produtos.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum produto vinculado.
              </p>
            )}
            {produtos.map((row, idx) => (
              <div key={idx} className="flex gap-2">
                <Select
                  value={row.productId}
                  onValueChange={(v) =>
                    setProdutos((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, productId: v } : r))
                    )
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.length === 0 && (
                      <SelectItem value="__none" disabled>
                        Cadastre um produto primeiro
                      </SelectItem>
                    )}
                    {products.map((p) => {
                      const b = brands.find((br) => br.id === p.brandId);
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {b?.nome ?? "?"} — {p.tipo}
                          {p.concentracaoMg ? ` ${p.concentracaoMg}mg` : ""}
                          {p.volumeMl ? `/${p.volumeMl}ml` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  className="w-24"
                  value={row.frascos}
                  onChange={(e) =>
                    setProdutos((prev) =>
                      prev.map((r, i) =>
                        i === idx
                          ? { ...r, frascos: Math.max(1, parseInt(e.target.value, 10) || 1) }
                          : r
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setProdutos((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
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
