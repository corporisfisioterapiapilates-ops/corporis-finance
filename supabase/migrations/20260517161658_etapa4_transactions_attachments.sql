-- ETAPA 4 — Lançamentos manuais
-- Tabelas: transactions, attachments
-- Observação: imports e credit_card_invoices entram em etapas futuras.
-- Por isso, import_id e credit_card_invoice_id ficam preparados como uuid sem FK nesta migration.

-- ──────────────────────────────────────────────────────────────────────────
-- transactions (lançamentos)
-- ──────────────────────────────────────────────────────────────────────────
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.chart_of_accounts(id) on delete restrict,
  counter_account_id uuid references public.accounts(id) on delete restrict,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount numeric(14,2) not null check (amount > 0),
  description text not null,
  event_date date not null,
  cash_date date not null,
  status text not null default 'cleared' check (status in ('pending', 'cleared')),
  credit_card_invoice_id uuid,
  source text not null default 'manual'
    check (source in ('manual', 'import_ofx', 'import_csv', 'import_pdf', 'recurring')),
  import_id uuid,
  external_id text,
  ai_categorized boolean not null default false,
  ai_confidence numeric(3,2) check (ai_confidence between 0 and 1 or ai_confidence is null),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_transfer_accounts_check check (
    (type = 'transfer' and counter_account_id is not null and category_id is null)
    or (type in ('income', 'expense') and counter_account_id is null and category_id is not null)
  ),
  constraint transactions_distinct_transfer_accounts_check check (
    counter_account_id is null or counter_account_id <> account_id
  )
);

create index transactions_organization_cash_date_idx
  on public.transactions(organization_id, cash_date desc);
create index transactions_organization_account_cash_date_idx
  on public.transactions(organization_id, account_id, cash_date desc);
create index transactions_organization_category_idx
  on public.transactions(organization_id, category_id);
create index transactions_organization_credit_card_invoice_idx
  on public.transactions(organization_id, credit_card_invoice_id);
create unique index transactions_org_external_source_unique_idx
  on public.transactions(organization_id, source, external_id)
  where external_id is not null;

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- attachments (anexos de lançamentos)
-- ──────────────────────────────────────────────────────────────────────────
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  storage_path text not null,
  filename text,
  mime_type text,
  size_bytes int check (size_bytes >= 0 or size_bytes is null),
  created_at timestamptz not null default now()
);

create index attachments_organization_transaction_idx
  on public.attachments(organization_id, transaction_id);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS — isolamento por organização (CLAUDE.md §6)
-- ──────────────────────────────────────────────────────────────────────────
alter table public.transactions enable row level security;
alter table public.attachments enable row level security;

create policy "transactions_org_isolation" on public.transactions
  for all to authenticated
  using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "attachments_org_isolation" on public.attachments
  for all to authenticated
  using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());
