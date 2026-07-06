import { useEffect, useState, useCallback } from "react";

export type AlertaDias = number;

export interface State {
  id: string;
  sigla: string;
  nome: string;
  mesesFornecimento: number; // 12 = anual, 6 = semestral, etc.
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
  moeda?: Moeda; // padrão BRL
  concentracaoMg?: number; // ex.: 1500
  volumeMl?: number; // ex.: 30
}

export interface Patient {
  id: string;
  nome: string;
  cpf: string;
  estado: string; // sigla do estado
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
  objeto: string; // descrição do que a decisão obriga fornecer
  criadoEm: string;
}

export type CumprimentoStatus =
  | "em_andamento"
  | "concluido"
  | "cancelado";

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
  produtosPrescritos: string; // texto livre (produtos + posologia)
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
  // Extensões (novo modelo)
  cumprimentoId?: string | null;
  status?: FunilStatus;
  items?: FulfillmentItem[];
  valorVendidoEstado?: number | null;
  // Datas do funil
  dataInvoiceSolicitada?: string | null;
  dataInvoiceEnviado?: string | null;
  dataAguardandoLI?: string | null;
  dataLI?: string | null;
  dataTransito?: string | null;
  dataDesembaraco?: string | null;
  dataLiberadoSES?: string | null;
  dataPagoSES?: string | null;
  dataRepasse?: string | null;
  etaDias?: number; // padrão 21 (dias após L.I. p/ receber)
  // Câmbio fechado no repasse
  fxTaxaFechada?: number | null;
  fxDataFechamento?: string | null;
  fxOrigem?: "historica" | "manual" | null;
}

const KEYS = {
  brands: "cbd.brands",
  patients: "cbd.patients",
  fulfillments: "cbd.fulfillments",
  states: "cbd.states",
  products: "cbd.products",
  processos: "cbd.processos",
  cumprimentos: "cbd.cumprimentos",
  consultas: "cbd.consultas",
  receitas: "cbd.receitas",
} as const;

type Key = keyof typeof KEYS;
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

function read<K extends Key>(k: K): Model[K][] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEYS[k]);
    const data = raw ? (JSON.parse(raw) as Model[K][]) : [];
    if (k === "fulfillments") {
      return (data as Fulfillment[]).map(migrateFulfillment) as Model[K][];
    }
    return data;
  } catch {
    return [];
  }
}

function migrateFulfillment(f: Fulfillment): Fulfillment {
  if (f.status) return f;
  // Registros antigos: assumir "Repasse recebido" já que tinham dataDispensacao
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

function write<K extends Key>(k: K, v: Model[K][]) {
  window.localStorage.setItem(KEYS[k], JSON.stringify(v));
  window.dispatchEvent(new CustomEvent("cbd-db-change", { detail: k }));
}

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

export function useCollection<K extends Key>(key: K) {
  const [items, setItems] = useState<Model[K][]>(() => read(key));

  useEffect(() => {
    const refresh = () => setItems(read(key));
    const onCustom = (e: Event) => {
      if ((e as CustomEvent).detail === key) refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEYS[key]) refresh();
    };
    window.addEventListener("cbd-db-change", onCustom);
    window.addEventListener("storage", onStorage);
    refresh();
    return () => {
      window.removeEventListener("cbd-db-change", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  const upsert = useCallback(
    (item: Model[K]) => {
      const all = read(key);
      const i = all.findIndex((x) => x.id === item.id);
      if (i >= 0) all[i] = item;
      else all.push(item);
      write(key, all);
    },
    [key]
  );

  const remove = useCallback(
    (id: string) => {
      write(
        key,
        read(key).filter((x) => x.id !== id)
      );
    },
    [key]
  );

  return { items, upsert, remove };
}

export function exportAll(): string {
  const data = {
    brands: read("brands"),
    patients: read("patients"),
    fulfillments: read("fulfillments"),
    states: read("states"),
    products: read("products"),
    processos: read("processos"),
    cumprimentos: read("cumprimentos"),
    consultas: read("consultas"),
    receitas: read("receitas"),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAll(json: string) {
  const data = JSON.parse(json);
  if (Array.isArray(data.brands)) write("brands", data.brands);
  if (Array.isArray(data.patients)) write("patients", data.patients);
  if (Array.isArray(data.fulfillments)) write("fulfillments", data.fulfillments);
  if (Array.isArray(data.states)) write("states", data.states);
  if (Array.isArray(data.products)) write("products", data.products);
  if (Array.isArray(data.processos)) write("processos", data.processos);
  if (Array.isArray(data.cumprimentos))
    write("cumprimentos", data.cumprimentos);
  if (Array.isArray(data.consultas)) write("consultas", data.consultas);
  if (Array.isArray(data.receitas)) write("receitas", data.receitas);
}

export function getAll<K extends Key>(key: K): Model[K][] {
  return read(key);
}

// Seed default states on first run
export function seedStatesIfEmpty() {
  if (typeof window === "undefined") return;
  const cur = read("states");
  if (cur.length > 0) return;
  write("states", [
    { id: uid(), sigla: "SP", nome: "São Paulo", mesesFornecimento: 12 },
    { id: uid(), sigla: "BA", nome: "Bahia", mesesFornecimento: 6 },
  ]);
}
