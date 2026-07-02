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
}

const KEYS = {
  brands: "cbd.brands",
  patients: "cbd.patients",
  fulfillments: "cbd.fulfillments",
  states: "cbd.states",
} as const;

type Key = keyof typeof KEYS;
type Model = {
  brands: Brand;
  patients: Patient;
  fulfillments: Fulfillment;
  states: State;
};

function read<K extends Key>(k: K): Model[K][] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEYS[k]);
    return raw ? (JSON.parse(raw) as Model[K][]) : [];
  } catch {
    return [];
  }
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
