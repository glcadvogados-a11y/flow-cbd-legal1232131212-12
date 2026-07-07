import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AlertaDias = number;

export interface State {
  id: string;
  sigla: string;
  nome: string;
  mesesFornecimento: number;
}

export interface Brand {
  id: string;
  nome: string;
  precoFrasco: number;
  comissaoPct: number;
  contato?: string;
  ativo?: boolean;
}

export type TipoCBD = "Isolado" | "Full Spectrum" | "Broad Spectrum";
export const TIPOS_CBD: TipoCBD[] = [
  "Isolado",
  "Full Spectrum",
  "Broad Spectrum",
];

export type Moeda = "BRL" | "USD";
export const MOEDAS: Moeda[] = ["BRL", "USD"];

export interface Product {
  id: string;
  brandId: string;
  tipo: TipoCBD;
  precoFrasco: number;
  comissaoPct: number;
  ativo: boolean;
  moeda?: Moeda;
  concentracaoMg?: number;
  volumeMl?: number;
}

export interface Patient {
  id: string;
  nome: string;
  cpf: string;
  estado: string;
  brandId: string | null;
  frascosPorPedido: number;
  alertaDias: AlertaDias;
  criadoEm: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
  statusManual?: PatientStatusManual;
  produtos?: PatientProduto[];
  frascosPorMes?: number;
}

export type PatientStatusManual = "auto" | "aguardando" | "cumprido";

export interface PatientProduto {
  productId: string;
  frascos: number;
}

export type ProcessoStatus =
  | "em_andamento"
  | "invoice"
  | "li_emitida"
  | "desembaraco"
  | "concluido"
  | "suspenso";

export interface Processo {
  id: string;
  patientId: string;
  numeroCNJ: string;
  tipo: "liminar" | "merito";
  vara: string;
  dataProtocolo: string;
  dataDecisao?: string;
  status: ProcessoStatus;
  objeto: string;
  criadoEm: string;
}

export type CumprimentoStatus = "em_andamento" | "concluido" | "cancelado";

export interface Cumprimento {
  id: string;
  processoId: string;
  numero: string;
  dataProtocolo: string;
  periodoInicio?: string;
  periodoFim?: string;
  status: CumprimentoStatus;
  observacoes?: string;
  duracaoMeses?: number;
  dataConclusao?: string;
  items?: CumprimentoItem[];
  fulfillmentId?: string | null;
}

export interface CumprimentoItem {
  productId: string | null;
  frascos: number;
  precoFrascoOverride?: number;
}

export type FunilStatus =
  | "solicitacao_invoice"
  | "invoice_enviado"
  | "aguardando_li"
  | "li_emitida"
  | "transito"
  | "desembaraco_rf"
  | "liberado_ses"
  | "pago_ses"
  | "repasse_recebido"
  | "cancelado";

export interface FulfillmentItem {
  productId: string | null;
  brandNomeSnapshot: string;
  tipoSnapshot: TipoCBD | string;
  precoFrascoSnapshot: number;
  comissaoPctSnapshot: number;
  frascos: number;
  moedaSnapshot?: Moeda;
}

export interface Consulta {
  id: string;
  patientId: string;
  data: string;
  medico: string;
  valor: number;
  observacoes?: string;
}

export interface Receita {
  id: string;
  patientId: string;
  medico: string;
  dataEmissao: string;
  dataValidade: string;
  produtosPrescritos: string;
  arquivoNome?: string;
  observacoes?: string;
}

export interface Fulfillment {
  id: string;
  patientId: string;
  numeroCumprimento: string;
  dataProtocolo: string;
  dataDispensacao: string;
  dataVencimento: string;
  frascos: number;
  valorRecebido: number;
  observacoes: string;
  brandIdSnapshot: string | null;
  brandNomeSnapshot: string;
  precoFrascoSnapshot: number;
  comissaoPctSnapshot: number;
  comissaoValorSnapshot: number;
  cumprimentoId?: string | null;
  status?: FunilStatus;
  items?: FulfillmentItem[];
  valorVendidoEstado?: number | null;
  dataInvoiceSolicitada?: string | null;
  dataInvoiceEnviado?: string | null;
  dataAguardandoLI?: string | null;
  dataLI?: string | null;
  dataTransito?: string | null;
  dataDesembaraco?: string | null;
  dataLiberadoSES?: string | null;
  dataPagoSES?: string | null;
  dataRepasse?: string | null;
  etaDias?: number;
  fxTaxaFechada?: number | null;
  fxDataFechamento?: string | null;
  fxOrigem?: "historica" | "manual" | null;
}

const COLLECTIONS = [
  "brands",
  "patients",
  "fulfillments",
  "states",
  "products",
  "processos",
  "cumprimentos",
  "consultas",
  "receitas",
] as const;

type Key = (typeof COLLECTIONS)[number];

type Model = {
  brands: Brand;
  patients: Patient;
  fulfillments: Fulfillment;
  states: State;
  products: Product;
  processos: Processo;
  cumprimentos: Cumprimento;
  consultas: Consulta;
  receitas: Receita;
};

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ------- Supabase-backed collection -------
// In-memory cache shared across hook instances for the same collection,
// so navigation between screens is instantaneous and updates are consistent.
const cache: Partial<Record<Key, unknown[]>> = {};
const subscribers: Partial<Record<Key, Set<(v: unknown[]) => void>>> = {};
const loading: Partial<Record<Key, Promise<unknown[]>>> = {};

function notify<K extends Key>(k: K) {
  subscribers[k]?.forEach((cb) => cb(cache[k] ?? []));
}

async function fetchCollection<K extends Key>(k: K): Promise<Model[K][]> {
  const { data, error } = await supabase
    .from("records")
    .select("data")
    .eq("collection", k);
  if (error) {
    console.error("[db] fetch", k, error);
    return [];
  }
  const items = (data ?? []).map((r) => r.data as unknown as Model[K]);
  if (k === "fulfillments") {
    return (items as unknown as Fulfillment[]).map(
      migrateFulfillment,
    ) as Model[K][];
  }
  return items;
}

async function ensureLoaded<K extends Key>(k: K): Promise<Model[K][]> {
  if (cache[k]) return cache[k] as Model[K][];
  if (!loading[k]) {
    loading[k] = fetchCollection(k).then((items) => {
      cache[k] = items;
      notify(k);
      return items;
    });
  }
  return (await loading[k]) as Model[K][];
}

function migrateFulfillment(f: Fulfillment): Fulfillment {
  if (f.status) return f;
  const items: FulfillmentItem[] =
    f.items && f.items.length > 0
      ? f.items
      : [
          {
            productId: null,
            brandNomeSnapshot: f.brandNomeSnapshot,
            tipoSnapshot: "—",
            precoFrascoSnapshot: f.precoFrascoSnapshot,
            comissaoPctSnapshot: f.comissaoPctSnapshot,
            frascos: f.frascos,
          },
        ];
  return {
    ...f,
    items,
    status: "repasse_recebido",
    dataRepasse: f.dataDispensacao,
    dataLI: f.dataDispensacao,
    dataDesembaraco: f.dataDispensacao,
    dataLiberadoSES: f.dataDispensacao,
    dataPagoSES: f.dataDispensacao,
    etaDias: 21,
    valorVendidoEstado: f.valorRecebido || null,
    cumprimentoId: null,
  };
}

export function useCollection<K extends Key>(key: K) {
  const [items, setItems] = useState<Model[K][]>(
    () => (cache[key] as Model[K][]) ?? [],
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!subscribers[key]) subscribers[key] = new Set();
    const cb = (v: unknown[]) => {
      if (mounted.current) setItems(v as Model[K][]);
    };
    subscribers[key]!.add(cb);
    ensureLoaded(key).then((v) => {
      if (mounted.current) setItems(v);
    });
    return () => {
      mounted.current = false;
      subscribers[key]!.delete(cb);
    };
  }, [key]);

  const upsert = useCallback(
    async (item: Model[K]) => {
      const list = ((cache[key] as Model[K][]) ?? []).slice();
      const idx = list.findIndex((x) => (x as { id: string }).id === (item as { id: string }).id);
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      cache[key] = list;
      notify(key);
      const { error } = await supabase.from("records").upsert({
        id: (item as { id: string }).id,
        collection: key,
        data: item as never,
      });
      if (error) console.error("[db] upsert", key, error);
    },
    [key],
  );

  const remove = useCallback(
    async (id: string) => {
      const list = ((cache[key] as Model[K][]) ?? []).filter(
        (x) => (x as { id: string }).id !== id,
      );
      cache[key] = list;
      notify(key);
      const { error } = await supabase
        .from("records")
        .delete()
        .eq("id", id)
        .eq("collection", key);
      if (error) console.error("[db] remove", key, error);
    },
    [key],
  );

  return { items, upsert, remove };
}

export async function exportAll(): Promise<string> {
  const entries = await Promise.all(
    COLLECTIONS.map(async (k) => [k, await ensureLoaded(k)] as const),
  );
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  for (const [k, v] of entries) out[k] = v;
  return JSON.stringify(out, null, 2);
}

export async function importAll(json: string) {
  const data = JSON.parse(json);
  for (const k of COLLECTIONS) {
    const arr = data[k];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const rows = arr
      .filter((x: unknown) => x && typeof x === "object" && "id" in (x as object))
      .map((x: { id: string }) => ({ id: x.id, collection: k, data: x as never }));
    if (rows.length === 0) continue;
    const { error } = await supabase.from("records").upsert(rows);
    if (error) {
      console.error("[db] import", k, error);
      throw error;
    }
    cache[k] = arr;
    notify(k);
  }
}

// One-time migration: copy data from browser localStorage (old app) to cloud.
export async function importFromLocalStorage(): Promise<{ total: number }> {
  if (typeof window === "undefined") return { total: 0 };
  const legacyKeys: Record<Key, string> = {
    brands: "cbd.brands",
    patients: "cbd.patients",
    fulfillments: "cbd.fulfillments",
    states: "cbd.states",
    products: "cbd.products",
    processos: "cbd.processos",
    cumprimentos: "cbd.cumprimentos",
    consultas: "cbd.consultas",
    receitas: "cbd.receitas",
  };
  const bundle: Record<string, unknown> = {};
  let total = 0;
  for (const k of COLLECTIONS) {
    try {
      const raw = window.localStorage.getItem(legacyKeys[k]);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        bundle[k] = parsed;
        total += parsed.length;
      }
    } catch {
      // ignore malformed entry
    }
  }
  if (total > 0) {
    await importAll(JSON.stringify(bundle));
  }
  return { total };
}

export async function seedStatesIfEmpty() {
  const cur = await ensureLoaded("states");
  if (cur.length > 0) return;
  const defaults: State[] = [
    { id: uid(), sigla: "SP", nome: "São Paulo", mesesFornecimento: 12 },
    { id: uid(), sigla: "BA", nome: "Bahia", mesesFornecimento: 6 },
  ];
  const rows = defaults.map((d) => ({
    id: d.id,
    collection: "states",
    data: d as never,
  }));
  const { error } = await supabase.from("records").upsert(rows);
  if (error) {
    console.error("[db] seed states", error);
    return;
  }
  cache.states = defaults;
  notify("states");
}
