import { useCallback, useEffect, useState } from "react";

const CACHE_KEY = "cbd.fx.usdbrl";
const HIST_KEY = "cbd.fx.usdbrl.hist";
const TTL_MS = 30 * 60 * 1000; // 30 min

interface FxCache {
  rate: number;
  updatedAt: string; // ISO
}

interface HistCache {
  [dateISO: string]: number; // YYYY-MM-DD -> rate
}

function readCache(): FxCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as FxCache) : null;
  } catch {
    return null;
  }
}

function writeCache(c: FxCache) {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  window.dispatchEvent(new Event("cbd-fx-change"));
}

function readHist(): HistCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(HIST_KEY);
    return raw ? (JSON.parse(raw) as HistCache) : {};
  } catch {
    return {};
  }
}

function writeHist(h: HistCache) {
  window.localStorage.setItem(HIST_KEY, JSON.stringify(h));
}

export async function fetchCurrentRate(): Promise<FxCache> {
  const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
  if (!res.ok) throw new Error("Falha na cotação");
  const j = await res.json();
  const rate = Number(j?.USDBRL?.bid);
  if (!rate || Number.isNaN(rate)) throw new Error("Cotação inválida");
  const c: FxCache = { rate, updatedAt: new Date().toISOString() };
  writeCache(c);
  return c;
}

export async function fetchHistoricRate(dateISO: string): Promise<number> {
  const hist = readHist();
  if (hist[dateISO]) return hist[dateISO];
  const compact = dateISO.replace(/-/g, "");
  const res = await fetch(
    `https://economia.awesomeapi.com.br/json/daily/USD-BRL/1?start_date=${compact}&end_date=${compact}`,
  );
  if (!res.ok) throw new Error("Falha na cotação histórica");
  const arr = await res.json();
  const rate = Number(arr?.[0]?.bid);
  if (!rate || Number.isNaN(rate)) throw new Error("Cotação histórica indisponível");
  hist[dateISO] = rate;
  writeHist(hist);
  return rate;
}

export function useFxRate() {
  const [state, setState] = useState<FxCache | null>(() => readCache());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    const cur = readCache();
    if (!force && cur && Date.now() - new Date(cur.updatedAt).getTime() < TTL_MS) {
      setState(cur);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const c = await fetchCurrentRate();
      setState(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const onChange = () => setState(readCache());
    window.addEventListener("cbd-fx-change", onChange);
    return () => window.removeEventListener("cbd-fx-change", onChange);
  }, [load]);

  return { rate: state?.rate ?? null, updatedAt: state?.updatedAt ?? null, loading, error, reload: () => load(true) };
}

export function toBRL(value: number, moeda: "BRL" | "USD", rate: number | null): number | null {
  if (moeda === "BRL") return value;
  if (rate == null) return null;
  return value * rate;
}

export function toUSD(value: number, moeda: "BRL" | "USD", rate: number | null): number | null {
  if (moeda === "USD") return value;
  if (rate == null || rate === 0) return null;
  return value / rate;
}
