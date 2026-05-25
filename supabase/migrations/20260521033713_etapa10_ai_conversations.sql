-- ETAPA 10 — Consultor IA
-- Histórico de conversas e mensagens por organização.

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_org_updated_idx
  on public.ai_conversations(organization_id, updated_at desc);

create index ai_conversations_user_idx
  on public.ai_conversations(user_id);

create trigger ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ai_messages_conversation_created_idx
  on public.ai_messages(conversation_id, created_at);

create index ai_messages_org_idx
  on public.ai_messages(organization_id);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy "ai_conversations_org_select" on public.ai_conversations
  for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "ai_conversations_org_insert" on public.ai_conversations
  for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and user_id = (select auth.uid())
  );

create policy "ai_conversations_org_update" on public.ai_conversations
  for update to authenticated
  using (organization_id = public.auth_org_id())
  with check (
    organization_id = public.auth_org_id()
    and user_id = (select auth.uid())
  );

create policy "ai_conversations_org_delete" on public.ai_conversations
  for delete to authenticated
  using (organization_id = public.auth_org_id());

create policy "ai_messages_org_select" on public.ai_messages
  for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "ai_messages_org_insert" on public.ai_messages
  for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and exists (
      select 1
      from public.ai_conversations c
      where c.id = conversation_id
        and c.organization_id = public.auth_org_id()
    )
  );

create policy "ai_messages_org_update" on public.ai_messages
  for update to authenticated
  using (organization_id = public.auth_org_id())
  with check (
    organization_id = public.auth_org_id()
    and exists (
      select 1
      from public.ai_conversations c
      where c.id = conversation_id
        and c.organization_id = public.auth_org_id()
    )
  );

create policy "ai_messages_org_delete" on public.ai_messages
  for delete to authenticated
  using (organization_id = public.auth_org_id());
