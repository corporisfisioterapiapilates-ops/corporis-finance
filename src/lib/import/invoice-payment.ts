type CardCandidate = {
  id: string;
  type: string;
  is_active: boolean;
  default_payment_account_id: string | null;
};

// Extratos brasileiros descrevem o pagamento de fatura de várias formas
// ("PAG FATURA", "DEB.CTA.FATURA-007892389", "PGTO CARTAO CREDITO", "PAGAMENTO FAT CARTAO"...).
const INVOICE_PAYMENT_PATTERN =
  /\bdeb\.?\s*cta\.?\s*fatura|\b(pag(?:to|amento|\.)?|liq(?:uidacao)?)\b.*\b(fatura|fat|cartao|cartoes)\b|\bfatura\b.*\b(cartao|pag)/;

export function looksLikeInvoicePayment(description: string): boolean {
  return INVOICE_PAYMENT_PATTERN.test(normalize(description));
}

// Pagamento de fatura é transferência conta → cartão, nunca despesa: as compras já foram
// categorizadas individualmente na importação da fatura. Só sugere quando o cartão é inequívoco.
export function suggestInvoicePaymentCard({
  description,
  type,
  accountId,
  accounts,
}: {
  description: string;
  type: string;
  accountId: string;
  accounts: CardCandidate[];
}): string | null {
  if (type !== "expense" || !looksLikeInvoicePayment(description)) return null;

  const cards = accounts.filter((account) => account.type === "credit_card" && account.is_active);
  const linked = cards.filter((card) => card.default_payment_account_id === accountId);
  if (linked.length === 1) return linked[0]?.id ?? null;
  if (cards.length === 1) return cards[0]?.id ?? null;
  return null;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
