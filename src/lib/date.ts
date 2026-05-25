import { format as fnsFormat } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

// TZ da organização. Multi-tenant futuro lê de organizations.timezone.
export const ORG_TZ = "America/Sao_Paulo";

/** Date UTC -> Date "parede" no fuso da org (para exibir/calcular dia). */
export function toOrgTime(date: Date | string): Date {
  return toZonedTime(typeof date === "string" ? new Date(date) : date, ORG_TZ);
}

/** Date "parede" da org -> instante UTC (para persistir). */
export function fromOrgTime(date: Date): Date {
  return fromZonedTime(date, ORG_TZ);
}

/** Formata data no fuso da org com locale pt-BR. Default: dd/MM/yyyy. */
export function formatDate(date: Date | string, pattern = "dd/MM/yyyy"): string {
  return fnsFormat(toOrgTime(date), pattern, { locale: ptBR });
}

/** "yyyy-MM-dd" no fuso da org — formato de coluna `date` do Postgres. */
export function toISODate(date: Date | string): string {
  return fnsFormat(toOrgTime(date), "yyyy-MM-dd");
}
