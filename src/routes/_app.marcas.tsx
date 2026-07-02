import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCollection, type Brand } from "@/lib/db";
import { comissaoPorFrasco } from "@/lib/domain";
import { brl } from "@/lib/format";
import { BrandForm } from "@/components/brand-form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/marcas")({
  component: Marcas,
});

function Marcas() {
  const { items: brands, remove } = useCollection("brands");
  const { items: patients } = useCollection("patients");
  const { items: fulfillments } = useCollection("fulfillments");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Marcas / Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            {brands.length} marca(s) cadastrada(s)
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nova marca
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="p-4">Nome</th>
                  <th className="p-4 text-right">Preço/frasco</th>
                  <th className="p-4 text-right">Comissão %</th>
                  <th className="p-4 text-right">Comissão/frasco</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {brands.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Nenhuma marca cadastrada.
                    </td>
                  </tr>
                )}
                {brands.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="p-4 font-medium">{b.nome}</td>
                    <td className="p-4 text-right">{brl(b.precoFrasco)}</td>
                    <td className="p-4 text-right">{b.comissaoPct}%</td>
                    <td className="p-4 text-right">
                      {brl(comissaoPorFrasco(b.precoFrasco, b.comissaoPct))}
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(b);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const inUse =
                            patients.some((p) => p.brandId === b.id) ||
                            fulfillments.some((f) => f.brandIdSnapshot === b.id);
                          if (inUse) {
                            toast.error(
                              "Marca vinculada a pacientes ou cumprimentos"
                            );
                            return;
                          }
                          if (confirm(`Excluir marca "${b.nome}"?`)) {
                            remove(b.id);
                            toast.success("Marca excluída");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <BrandForm open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}
