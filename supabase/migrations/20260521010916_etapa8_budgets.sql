-- ETAPA 8 — Orçamento anual
-- Tabelas: budget_versions, budget_values

create table public.budget_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year int not null check (year between 2000 and 2100),
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, year, name)
);

create index budget_versions_org_year_idx
  on public.budget_versions(organization_id, year, status, created_at);

create unique index budget_versions_one_active_per_year_idx
  on public.budget_versions(organization_id, year)
  where status = 'active';

create trigger budget_versions_updated_at
  before update on public.budget_versions
  for each row execute function public.set_updated_at();

create table public.budget_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_version_id uuid not null references public.budget_versions(id) on delete cascade,
  chart_account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  month int not null check (month between 1 and 12),
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_version_id, chart_account_id, month)
);

create index budget_values_org_version_idx
  on public.budget_values(organization_id, budget_version_id);

create index budget_values_account_idx
  on public.budget_values(chart_account_id);

create trigger budget_values_updated_at
  before update on public.budget_values
  for each row execute function public.set_updated_at();

alter table public.budget_versions enable row level security;
alter table public.budget_values enable row level security;

create policy "budget_versions_org_select" on public.budget_versions
  for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "budget_versions_org_insert" on public.budget_versions
  for insert to authenticated
  with check (organization_id = public.auth_org_id());

create policy "budget_versions_org_update" on public.budget_versions
  for update to authenticated
  using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "budget_versions_org_delete" on public.budget_versions
  for delete to authenticated
  using (organization_id = public.auth_org_id());

create policy "budget_values_org_select" on public.budget_values
  for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "budget_values_org_insert" on public.budget_values
  for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and exists (
      select 1
      from public.budget_versions bv
      where bv.id = budget_version_id
        and bv.organization_id = public.auth_org_id()
    )
    and exists (
      select 1
      from public.chart_of_accounts coa
      where coa.id = chart_account_id
        and coa.organization_id = public.auth_org_id()
    )
  );

create policy "budget_values_org_update" on public.budget_values
  for update to authenticated
  using (organization_id = public.auth_org_id())
  with check (
    organization_id = public.auth_org_id()
    and exists (
      select 1
      from public.budget_versions bv
      where bv.id = budget_version_id
        and bv.organization_id = public.auth_org_id()
    )
    and exists (
      select 1
      from public.chart_of_accounts coa
      where coa.id = chart_account_id
        and coa.organization_id = public.auth_org_id()
    )
  );

create policy "budget_values_org_delete" on public.budget_values
  for delete to authenticated
  using (organization_id = public.auth_org_id());
