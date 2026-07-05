import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCollection, type Brand, type Product } from "@/lib/db";
import { comissaoPorFrasco } from "@/lib/domain";
import { brl, money } from "@/lib/format";
import { BrandForm } from "@/components/brand-form";
import { ProductForm } from "@/components/product-form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/marcas")({
  component: Marcas,
});

function Marcas() {
  const { items: brands, remove } = useCollection("brands");
  const { items: products, remove: removeProduct } = useCollection("products");
  const { items: patients } = useCollection("patients");
  const { items: fulfillments } = useCollection("fulfillments");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [prodOpen, setProdOpen] = useState(false);
  const [prodBrandId, setProdBrandId] = useState<string>("");
  const [prodEditing, setProdEditing] = useState<Product | null>(null);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Marcas & Produtos</h1>
          <p className="text-sm text-muted-foreground">
            {brands.length} marca(s) • {products.length} produto(s)
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

      {brands.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma marca cadastrada.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {brands.map((b) => {
          const brandProducts = products.filter((p) => p.brandId === b.id);
          return (
            <Card key={b.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{b.nome}</h2>
                    <p className="text-xs text-muted-foreground">
                      {brandProducts.length} produto(s) cadastrado(s)
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setProdBrandId(b.id);
                        setProdEditing(null);
                        setProdOpen(true);
                      }}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Produto
                    </Button>
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
                          fulfillments.some((f) => f.brandIdSnapshot === b.id) ||
                          brandProducts.length > 0;
                        if (inUse) {
                          toast.error("Marca com produtos ou vínculos existentes");
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
                  </div>
                </div>
                {brandProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Nenhum produto — adicione Isolado / Full / Broad Spectrum com seus preços.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="pb-2">Tipo</th>
                          <th className="pb-2 text-right">Preço/frasco</th>
                          <th className="pb-2 text-right">Comissão %</th>
                          <th className="pb-2 text-right">Comissão/frasco</th>
                          <th className="pb-2 text-right">Status</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {brandProducts.map((p) => (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="py-2 font-medium">{p.tipo}</td>
                            <td className="py-2 text-right">{money(p.precoFrasco, p.moeda ?? "BRL")}</td>
                            <td className="py-2 text-right">{p.comissaoPct}%</td>
                            <td className="py-2 text-right">
                              {money(comissaoPorFrasco(p.precoFrasco, p.comissaoPct), p.moeda ?? "BRL")}
                            </td>
                            <td className="py-2 text-right">
                              {p.ativo ? "Ativo" : "Inativo"}
                            </td>
                            <td className="py-2 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setProdBrandId(b.id);
                                  setProdEditing(p);
                                  setProdOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm(`Excluir ${b.nome} — ${p.tipo}?`)) {
                                    removeProduct(p.id);
                                    toast.success("Produto excluído");
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
                )}
                <p className="text-xs text-muted-foreground">
                  Preço legado da marca (compat): {brl(b.precoFrasco)} • {b.comissaoPct}%
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <BrandForm open={open} onOpenChange={setOpen} editing={editing} />
      <ProductForm
        open={prodOpen}
        onOpenChange={setProdOpen}
        brandId={prodBrandId}
        editing={prodEditing}
      />
    </div>
  );
}
