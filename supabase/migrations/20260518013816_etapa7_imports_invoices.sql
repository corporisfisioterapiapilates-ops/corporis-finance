-- ETAPA 7 — Importações e faturas de cartão

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  import_type text not null check (import_type in ('ofx', 'csv', 'pdf_invoice')),
  filename text not null,
  status text not null default 'pending'
    check (status in ('pending', 'parsing', 'reviewing', 'completed', 'failed')),
  total_rows int not null default 0 check (total_rows >= 0),
  imported_rows int not null default 0 check (imported_rows >= 0),
  duplicates_found int not null default 0 check (duplicates_found >= 0),
  raw_content text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint imports_account_org_check check (
    account_id is null or organization_id is not null
  )
);

create index imports_organization_created_idx
  on public.imports(organization_id, created_at desc);
create index imports_organization_status_idx
  on public.imports(organization_id, status);

create table public.credit_card_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  closing_date date not null,
  due_date date not null,
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'open'
    check (status in ('open', 'closed', 'paid', 'partially_paid')),
  payment_transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_card_invoices_dates_check check (due_date >= closing_date)
);

create index credit_card_invoices_organization_due_idx
  on public.credit_card_invoices(organization_id, due_date desc);
create index credit_card_invoices_organization_account_idx
  on public.credit_card_invoices(organization_id, account_id);

alter table public.transactions
  add constraint transactions_credit_card_invoice_id_fkey
  foreign key (credit_card_invoice_id)
  references public.credit_card_invoices(id)
  on delete set null;

alter table public.transactions
  add constraint transactions_import_id_fkey
  foreign key (import_id)
  references public.imports(id)
  on delete set null;

create trigger credit_card_invoices_updated_at
  before update on public.credit_card_invoices
  for each row execute function public.set_updated_at();

alter table public.imports enable row level security;
alter table public.credit_card_invoices enable row level security;

create policy "imports_org_isolation" on public.imports
  for all to authenticated
  using (organization_id = public.auth_org_id())
  with check (
    organization_id = public.auth_org_id()
    and (
      account_id is null
      or exists (
        select 1 from public.accounts a
        where a.id = account_id and a.organization_id = public.auth_org_id()
      )
    )
  );

create policy "credit_card_invoices_org_isolation" on public.credit_card_invoices
  for all to authenticated
  using (organization_id = public.auth_org_id())
  with check (
    organization_id = public.auth_org_id()
    and exists (
      select 1 from public.accounts a
      where a.id = account_id
        and a.organization_id = public.auth_org_id()
        and a.type = 'credit_card'
    )
  );
