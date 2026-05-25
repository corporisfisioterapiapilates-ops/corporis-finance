-- ETAPA 2 — Auth + organização + plano de contas
-- Tabelas: organizations, profiles, accounts, chart_of_accounts
-- Nota de ordenação: accounts e chart_of_accounts são da ETAPA 3 no roadmap,
-- mas o onboarding (ETAPA 2) precisa persistir a 1ª conta e semear o plano.
-- ETAPA 3 adiciona apenas as telas/CRUD sobre estas tabelas.

-- ──────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- organizations
-- ──────────────────────────────────────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- profiles (extends auth.users)
-- ──────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete restrict,
  full_name text,
  role text not null default 'owner' check (role in ('owner', 'admin', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_organization_id_idx on public.profiles(organization_id);
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Org do usuário logado, sem recursão de RLS (SECURITY DEFINER).
create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- accounts (contas e cartões)
-- ──────────────────────────────────────────────────────────────────────────
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'cash', 'credit_card')),
  bank_name text,
  color text,
  opening_balance numeric(14,2) not null default 0,
  opening_balance_date date,
  credit_limit numeric(14,2),
  closing_day int check (closing_day between 1 and 31),
  due_day int check (due_day between 1 and 31),
  default_payment_account_id uuid references public.accounts(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_organization_id_idx on public.accounts(organization_id);
create trigger accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- chart_of_accounts (plano de contas — hierárquico)
-- ──────────────────────────────────────────────────────────────────────────
create table public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid references public.chart_of_accounts(id) on delete restrict,
  code text not null,
  name text not null,
  nature text not null check (nature in ('income', 'expense', 'transfer', 'calculated')),
  dfc_group text not null check (dfc_group in ('operational', 'non_operational', 'investment', 'financing')),
  cost_classification text check (cost_classification in ('fixed', 'variable') or cost_classification is null),
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index chart_of_accounts_org_parent_order_idx
  on public.chart_of_accounts(organization_id, parent_id, display_order);
create trigger chart_of_accounts_updated_at
  before update on public.chart_of_accounts
  for each row execute function public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- RLS — isolamento por organização (CLAUDE.md §6)
-- ──────────────────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.chart_of_accounts enable row level security;

create policy "organizations_org_isolation" on public.organizations
  for all to authenticated
  using (id = public.auth_org_id())
  with check (id = public.auth_org_id());

-- profile: usuário gerencia apenas a própria linha
create policy "profiles_self_access" on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "accounts_org_isolation" on public.accounts
  for all to authenticated
  using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "chart_of_accounts_org_isolation" on public.chart_of_accounts
  for all to authenticated
  using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

-- ──────────────────────────────────────────────────────────────────────────
-- Seed do plano de contas Corporis (referência: PROMPT_1_DESIGN.md §plano)
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.seed_corporis_chart(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  create temporary table _seed (
    code text, parent_code text, name text,
    nature text, dfc_group text, disp int
  ) on commit drop;

  insert into _seed (code, parent_code, name, nature, dfc_group, disp) values
  -- Grupo 1 — Receita Bruta (operacional)
  ('1', null, 'Receita Bruta', 'calculated', 'operational', 100),
  ('1.01', '1', 'Pilates', 'income', 'operational', 101),
  ('1.02', '1', 'Fisioterapia', 'income', 'operational', 102),
  ('1.03', '1', 'Fisio Pélvica', 'income', 'operational', 103),
  ('1.04', '1', 'Taping', 'income', 'operational', 104),
  ('1.05', '1', 'Primeira Consulta', 'income', 'operational', 105),
  ('1.06', '1', 'Combo', 'income', 'operational', 106),
  -- Grupo 2 — Impostos sobre a Receita
  ('2', null, 'Impostos sobre a Receita', 'calculated', 'operational', 200),
  ('2.01', '2', 'Simples Nacional', 'expense', 'operational', 201),
  ('2.02', '2', 'DARF', 'expense', 'operational', 202),
  -- Grupo 3 — Custos
  ('3', null, 'Custos', 'calculated', 'operational', 300),
  ('3.02', '3', 'Lavanderia', 'expense', 'operational', 302),
  ('3.03', '3', 'Materiais Fisio', 'expense', 'operational', 303),
  ('3.99', '3', 'Outros custos', 'expense', 'operational', 399),
  -- Grupo 4 — Despesas Operacionais
  ('4', null, 'Despesas Operacionais', 'calculated', 'operational', 400),
  ('4.01', '4', 'Despesas com RH', 'calculated', 'operational', 410),
  ('4.01.01', '4.01', 'Salário', 'expense', 'operational', 411),
  ('4.01.02', '4.01', 'Transporte', 'expense', 'operational', 412),
  ('4.01.03', '4.01', 'Alimentação', 'expense', 'operational', 413),
  ('4.01.04', '4.01', 'Bônus', 'expense', 'operational', 414),
  ('4.01.05', '4.01', 'Confraternizações', 'expense', 'operational', 415),
  ('4.01.06', '4.01', 'FGTS', 'expense', 'operational', 416),
  ('4.01.07', '4.01', 'INSS Patronal', 'expense', 'operational', 417),
  ('4.01.08', '4.01', 'Férias', 'expense', 'operational', 418),
  ('4.01.09', '4.01', 'Rescisão', 'expense', 'operational', 419),
  ('4.01.10', '4.01', '13º salário', 'expense', 'operational', 420),
  ('4.01.11', '4.01', 'Hora Extra', 'expense', 'operational', 421),
  ('4.01.12', '4.01', 'Treinamento', 'expense', 'operational', 422),
  ('4.01.13', '4.01', 'Pró-labore', 'expense', 'operational', 423),
  ('4.01.99', '4.01', 'Outras despesas com RH', 'expense', 'operational', 424),
  ('4.02', '4', 'Despesas Administrativas', 'calculated', 'operational', 430),
  ('4.02.01', '4.02', 'Aluguel e Condomínio', 'expense', 'operational', 431),
  ('4.02.02', '4.02', 'Luz/Água/Gás', 'expense', 'operational', 432),
  ('4.02.03', '4.02', 'Telefone e Internet', 'expense', 'operational', 433),
  ('4.02.04', '4.02', 'Contador', 'expense', 'operational', 434),
  ('4.02.05', '4.02', 'Taxas Burocráticas', 'expense', 'operational', 435),
  ('4.02.06', '4.02', 'Taxas Bancárias', 'expense', 'operational', 436),
  ('4.02.07', '4.02', 'Sistemas', 'expense', 'operational', 437),
  ('4.02.08', '4.02', 'Manutenção', 'expense', 'operational', 438),
  ('4.02.09', '4.02', 'Material Limpeza', 'expense', 'operational', 439),
  ('4.02.10', '4.02', 'Material Escritório', 'expense', 'operational', 440),
  ('4.02.11', '4.02', 'Viagens a negócio', 'expense', 'operational', 441),
  ('4.02.12', '4.02', 'Faxina/Limpeza', 'expense', 'operational', 442),
  ('4.02.13', '4.02', 'Cursos', 'expense', 'operational', 443),
  ('4.02.14', '4.02', 'Estacionamento', 'expense', 'operational', 444),
  ('4.02.15', '4.02', 'Consultoria', 'expense', 'operational', 445),
  ('4.02.16', '4.02', 'Mercado', 'expense', 'operational', 446),
  ('4.02.17', '4.02', 'Utensílios', 'expense', 'operational', 447),
  ('4.02.99', '4.02', 'Outras despesas administrativas', 'expense', 'operational', 448),
  ('4.03', '4', 'Despesas com Vendas', 'calculated', 'operational', 450),
  ('4.03.01', '4.03', 'Site', 'expense', 'operational', 451),
  ('4.03.02', '4.03', 'Comissão sobre Vendas', 'expense', 'operational', 452),
  ('4.03.03', '4.03', 'Taxas de Meio de Pagamento', 'expense', 'operational', 453),
  ('4.03.04', '4.03', 'Taxa de Boletos', 'expense', 'operational', 454),
  ('4.03.05', '4.03', 'Logística', 'expense', 'operational', 455),
  ('4.03.06', '4.03', 'Combustível', 'expense', 'operational', 456),
  ('4.03.07', '4.03', 'Assessoria de Marketing', 'expense', 'operational', 457),
  ('4.03.08', '4.03', 'Assessoria de Imprensa', 'expense', 'operational', 458),
  ('4.03.09', '4.03', 'Despesa com Mídia', 'expense', 'operational', 459),
  ('4.03.99', '4.03', 'Outras despesas com vendas', 'expense', 'operational', 460),
  -- Grupo 5 — Receita/Despesa Financeira (não operacional)
  ('5', null, 'Receita / Despesa Financeira', 'calculated', 'non_operational', 500),
  ('5.01', '5', 'Receita Financeira', 'income', 'non_operational', 501),
  ('5.02', '5', 'Despesa Financeira', 'expense', 'non_operational', 502),
  -- Grupo 6 — Resultado Não Operacional
  ('6', null, 'Resultado Não Operacional', 'calculated', 'non_operational', 600),
  ('6.01', '6', 'Receitas Não Operacionais', 'income', 'non_operational', 601),
  ('6.02', '6', 'Despesas Não Operacionais', 'expense', 'non_operational', 602),
  -- Grupo 7 — Investimento
  ('7', null, 'Investimento', 'calculated', 'investment', 700),
  ('7.01', '7', 'Obras Estruturais', 'expense', 'investment', 701),
  ('7.02', '7', 'Compra Máquinas e Equipamentos', 'expense', 'investment', 702),
  ('7.03', '7', 'Compra Materiais de serviço', 'expense', 'investment', 703),
  ('7.04', '7', 'Compra Escritório', 'expense', 'investment', 704),
  ('7.05', '7', 'Investimento em Mídia e Marketing', 'expense', 'investment', 705),
  ('7.06', '7', 'Investimento em Software', 'expense', 'investment', 706),
  ('7.99', '7', 'Outros investimentos', 'expense', 'investment', 799),
  -- Grupo 8 — Financeiro
  ('8', null, 'Financeiro', 'calculated', 'financing', 800),
  ('8.01', '8', 'Aumento Dívida', 'income', 'financing', 801),
  ('8.02', '8', 'Pagamento Dívida', 'expense', 'financing', 802),
  ('8.03', '8', 'Aporte Sócios', 'income', 'financing', 803),
  ('8.04', '8', 'Pagamento Dividendos', 'expense', 'financing', 804);

  -- 1ª passada: insere todos os nós (sem parent)
  insert into public.chart_of_accounts
    (organization_id, code, name, nature, dfc_group, display_order)
  select p_org, s.code, s.name, s.nature, s.dfc_group, s.disp
  from _seed s;

  -- 2ª passada: liga parent_id pelo parent_code
  for r in select code, parent_code from _seed where parent_code is not null loop
    update public.chart_of_accounts c
       set parent_id = p.id
      from public.chart_of_accounts p
     where c.organization_id = p_org and c.code = r.code
       and p.organization_id = p_org and p.code = r.parent_code;
  end loop;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- complete_onboarding — bootstrap atômico (bypassa RLS via SECURITY DEFINER)
-- p_account: { name, type, bank_name, color, opening_balance, opening_balance_date }
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.complete_onboarding(
  p_org_name text,
  p_full_name text,
  p_account jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and organization_id is not null) then
    raise exception 'Onboarding já concluído';
  end if;
  if coalesce(trim(p_org_name), '') = '' then
    raise exception 'Nome da clínica é obrigatório';
  end if;

  v_slug := regexp_replace(lower(trim(p_org_name)), '[^a-z0-9]+', '-', 'g')
            || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.organizations (name, slug)
  values (trim(p_org_name), v_slug)
  returning id into v_org_id;

  insert into public.profiles (id, organization_id, full_name, role)
  values (v_uid, v_org_id, nullif(trim(p_full_name), ''), 'owner')
  on conflict (id) do update
    set organization_id = excluded.organization_id,
        full_name = excluded.full_name;

  if p_account is not null and p_account ? 'name' then
    insert into public.accounts
      (organization_id, name, type, bank_name, color, opening_balance, opening_balance_date)
    values (
      v_org_id,
      p_account->>'name',
      coalesce(p_account->>'type', 'checking'),
      nullif(p_account->>'bank_name', ''),
      nullif(p_account->>'color', ''),
      coalesce((p_account->>'opening_balance')::numeric, 0),
      nullif(p_account->>'opening_balance_date', '')::date
    );
  end if;

  perform public.seed_corporis_chart(v_org_id);

  return v_org_id;
end;
$$;

revoke all on function public.complete_onboarding(text, text, jsonb) from public;
grant execute on function public.complete_onboarding(text, text, jsonb) to authenticated;
revoke all on function public.seed_corporis_chart(uuid) from public;
