-- ETAPA 11 — Notificações in-app
-- Tabela persistida para alertas financeiros acionáveis.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (
    type in (
      'invoice_due',
      'pending_transaction_due',
      'budget_overrun',
      'cash_risk',
      'import_review',
      'import_failed'
    )
  ),
  severity text not null check (severity in ('info', 'warning', 'danger')),
  title text not null,
  body text not null,
  action_label text,
  action_href text,
  dedupe_key text not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id, dedupe_key)
);

create index notifications_organization_created_idx
  on public.notifications(organization_id, created_at desc);

create index notifications_organization_read_dismissed_idx
  on public.notifications(organization_id, read_at, dismissed_at);

alter table public.notifications enable row level security;

create policy "notifications_org_select" on public.notifications
  for select to authenticated
  using (
    organization_id = public.auth_org_id()
    and (user_id is null or user_id = auth.uid())
  );

create policy "notifications_org_insert" on public.notifications
  for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and (user_id is null or user_id = auth.uid())
  );

create policy "notifications_org_update" on public.notifications
  for update to authenticated
  using (
    organization_id = public.auth_org_id()
    and (user_id is null or user_id = auth.uid())
  )
  with check (
    organization_id = public.auth_org_id()
    and (user_id is null or user_id = auth.uid())
  );

create policy "notifications_org_delete" on public.notifications
  for delete to authenticated
  using (
    organization_id = public.auth_org_id()
    and (user_id is null or user_id = auth.uid())
  );
