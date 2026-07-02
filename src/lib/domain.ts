import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Fulfillment, Patient } from "./db";

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
  const own = fulfillments
    .filter((f) => f.patientId === patient.id)
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
