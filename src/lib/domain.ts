import { differenceInCalendarDays, parseISO } from "date-fns";
import { addDays, format } from "date-fns";
import type {
  Fulfillment,
  FulfillmentItem,
  FunilStatus,
  Patient,
} from "./db";

export type StatusColor = "red" | "yellow" | "green" | "gray";

export interface PatientStatus {
  color: StatusColor;
  label: string;
  daysToExpire: number | null;
  lastFulfillment: Fulfillment | null;
}

export function computeStatus(
  patient: Patient,
  fulfillments: Fulfillment[]
): PatientStatus {
  const manual = patient.statusManual ?? "auto";
  if (manual === "aguardando") {
    return { color: "yellow", label: "Aguardando cumprimento", daysToExpire: null, lastFulfillment: null };
  }
  if (manual === "cumprido") {
    return { color: "green", label: "Cumprido", daysToExpire: null, lastFulfillment: null };
  }
  const own = fulfillments
    .filter((f) => f.patientId === patient.id && (f.status ?? "repasse_recebido") === "repasse_recebido")
    .sort((a, b) => b.dataDispensacao.localeCompare(a.dataDispensacao));
  const last = own[0] ?? null;
  if (!last) {
    return {
      color: "gray",
      label: "Sem cumprimentos",
      daysToExpire: null,
      lastFulfillment: null,
    };
  }
  const days = differenceInCalendarDays(parseISO(last.dataVencimento), new Date());
  if (days < 0)
    return { color: "red", label: "Vencido", daysToExpire: days, lastFulfillment: last };
  if (days <= patient.alertaDias)
    return {
      color: "yellow",
      label: `Vence em ${days}d`,
      daysToExpire: days,
      lastFulfillment: last,
    };
  return {
    color: "green",
    label: `Em dia (${days}d)`,
    daysToExpire: days,
    lastFulfillment: last,
  };
}

export function comissaoPorFrasco(precoFrasco: number, pct: number): number {
  return (precoFrasco * pct) / 100;
}

// ============ CRM: contagem regressiva para novo protocolo ============

export interface ProtocolCountdown {
  hasData: boolean;
  daysLeft: number | null;
  deadline: string | null; // ISO date do prazo para protocolar
  endDate: string | null; // ISO date da estimativa de término do medicamento
  duracaoDias: number | null;
  frascos: number;
  frascosPorMes: number | null;
  color: StatusColor;
  label: string;
}

export function computeProtocolCountdown(
  patient: Patient,
  fulfillments: Fulfillment[]
): ProtocolCountdown {
  const empty: ProtocolCountdown = {
    hasData: false,
    daysLeft: null,
    deadline: null,
    endDate: null,
    duracaoDias: null,
    frascos: 0,
    frascosPorMes: patient.frascosPorMes ?? null,
    color: "gray",
    label: "Sem dispensação",
  };
  const last = fulfillments
    .filter((f) => f.patientId === patient.id && (f.status ?? "repasse_recebido") === "repasse_recebido")
    .sort((a, b) => b.dataDispensacao.localeCompare(a.dataDispensacao))[0];
  if (!last) return empty;
  const frascos = frascosTotal(last);
  const fpm = patient.frascosPorMes ?? 0;
  if (!fpm || fpm <= 0 || !frascos) {
    return { ...empty, hasData: false, label: "Informe frascos/mês" };
  }
  const duracao = Math.round((frascos / fpm) * 30);
  const start = parseISO(last.dataDispensacao);
  const end = addDays(start, duracao);
  const deadline = addDays(end, -patient.alertaDias);
  const days = differenceInCalendarDays(deadline, new Date());
  const color: StatusColor =
    days < 0 ? "red" : days <= Math.max(15, Math.round(patient.alertaDias / 3)) ? "yellow" : "green";
  const label =
    days < 0
      ? `Atrasado ${Math.abs(days)}d`
      : days === 0
        ? "Protocolar hoje"
        : `${days}d p/ protocolar`;
  return {
    hasData: true,
    daysLeft: days,
    deadline: format(deadline, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
    duracaoDias: duracao,
    frascos,
    frascosPorMes: fpm,
    color,
    label,
  };
}

// ============ Funil de status ============

export interface FunilStep {
  key: FunilStatus;
  label: string;
  short: string;
  dateField: keyof Fulfillment; // qual data marca a entrada nesta etapa
  projected?: boolean; // conta como projetado no financeiro
  realized?: boolean; // conta como realizado
  terminal?: boolean;
}

export const FUNIL_STEPS: FunilStep[] = [
  {
    key: "solicitacao_invoice",
    label: "Solicitação de invoice",
    short: "Invoice pedido",
    dateField: "dataInvoiceSolicitada",
  },
  {
    key: "invoice_enviado",
    label: "Invoice enviado",
    short: "Invoice enviado",
    dateField: "dataInvoiceEnviado",
  },
  {
    key: "aguardando_li",
    label: "Aguardando L.I.",
    short: "Aguard. L.I.",
    dateField: "dataAguardandoLI",
  },
  {
    key: "li_emitida",
    label: "L.I. emitida",
    short: "L.I. emitida",
    dateField: "dataLI",
    projected: true,
  },
  {
    key: "transito",
    label: "Produto em trânsito",
    short: "Em trânsito",
    dateField: "dataTransito",
    projected: true,
  },
  {
    key: "desembaraco_rf",
    label: "Desembaraço na Receita Federal",
    short: "Desembaraço RF",
    dateField: "dataDesembaraco",
    projected: true,
  },
  {
    key: "liberado_ses",
    label: "Liberado para SES",
    short: "Liberado SES",
    dateField: "dataLiberadoSES",
    projected: true,
  },
  {
    key: "pago_ses",
    label: "Pago pela SES",
    short: "Pago SES",
    dateField: "dataPagoSES",
    projected: true,
  },
  {
    key: "repasse_recebido",
    label: "Repasse recebido",
    short: "Recebido",
    dateField: "dataRepasse",
    realized: true,
    terminal: true,
  },
  {
    key: "cancelado",
    label: "Cancelado",
    short: "Cancelado",
    dateField: "dataInvoiceSolicitada",
    terminal: true,
  },
];

export function funilStep(status: FunilStatus | undefined): FunilStep {
  return (
    FUNIL_STEPS.find((s) => s.key === status) ?? FUNIL_STEPS[0]
  );
}

export function funilIndex(status: FunilStatus | undefined): number {
  return FUNIL_STEPS.findIndex((s) => s.key === status);
}

export const ETA_DIAS_DEFAULT = 21;

export function comissaoItem(it: FulfillmentItem): number {
  return (
    (it.precoFrascoSnapshot * it.frascos * it.comissaoPctSnapshot) / 100
  );
}

export function comissaoTotal(f: Fulfillment): number {
  const items = f.items ?? [];
  if (items.length === 0) {
    return f.comissaoValorSnapshot * f.frascos;
  }
  return items.reduce((a, it) => a + comissaoItem(it), 0);
}

export function valorTotalEstado(f: Fulfillment): number {
  if (typeof f.valorVendidoEstado === "number" && f.valorVendidoEstado > 0) {
    return f.valorVendidoEstado;
  }
  const items = f.items ?? [];
  if (items.length === 0) return f.valorRecebido;
  return items.reduce(
    (a, it) => a + it.precoFrascoSnapshot * it.frascos,
    0
  );
}

export function frascosTotal(f: Fulfillment): number {
  const items = f.items ?? [];
  if (items.length === 0) return f.frascos;
  return items.reduce((a, it) => a + it.frascos, 0);
}

export function isRealized(f: Fulfillment): boolean {
  return (f.status ?? "repasse_recebido") === "repasse_recebido";
}

export function isProjected(f: Fulfillment): boolean {
  const s = f.status ?? "repasse_recebido";
  const step = funilStep(s);
  return !!step.projected && s !== "cancelado";
}

export function isCancelled(f: Fulfillment): boolean {
  return f.status === "cancelado";
}

export function etaRecebimento(f: Fulfillment): string | null {
  if (!f.dataLI) return null;
  const dias = f.etaDias ?? ETA_DIAS_DEFAULT;
  return addDays(parseISO(f.dataLI), dias).toISOString().slice(0, 10);
}

export function dataRelevante(f: Fulfillment): string {
  // Usada para agrupar no financeiro: repasse (se recebido) ou ETA (projeção)
  if (isRealized(f) && f.dataRepasse) return f.dataRepasse;
  const eta = etaRecebimento(f);
  if (eta) return eta;
  return f.dataDispensacao || f.dataProtocolo || new Date().toISOString().slice(0, 10);
}
