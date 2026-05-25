-- ETAPA 7 — Memória de categorização

create table public.category_memory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  normalized_description text not null,
  sample_description text not null,
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  category_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  confidence numeric(4,3) not null default 0.95 check (confidence >= 0 and confidence <= 1),
  usage_count int not null default 1 check (usage_count >= 0),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_memory_unique_description_type unique (
    organization_id,
    normalized_description,
    transaction_type
  )
);

create index category_memory_organization_lookup_idx
  on public.category_memory(organization_id, transaction_type, normalized_description);
create index category_memory_category_idx
  on public.category_memory(category_id);

create trigger category_memory_updated_at
  before update on public.category_memory
  for each row execute function public.set_updated_at();

alter table public.category_memory enable row level security;

create policy "category_memory_org_isolation" on public.category_memory
  for all to authenticated
  using (organization_id = public.auth_org_id())
  with check (
    organization_id = public.auth_org_id()
    and exists (
      select 1 from public.chart_of_accounts c
      where c.id = category_id
        and c.organization_id = public.auth_org_id()
        and c.nature = transaction_type
    )
  );

insert into public.category_memory (
  organization_id,
  normalized_description,
  sample_description,
  transaction_type,
  category_id,
  confidence,
  usage_count,
  last_used_at
)
select distinct on (
  t.organization_id,
  btrim(regexp_replace(
    lower(translate(
      t.description,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    )),
    '[^a-z0-9]+',
    ' ',
    'g'
  )),
  t.type
)
  t.organization_id,
  btrim(regexp_replace(
    lower(translate(
      t.description,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    )),
    '[^a-z0-9]+',
    ' ',
    'g'
  )) as normalized_description,
  t.description,
  t.type,
  t.category_id,
  0.95,
  1,
  now()
from public.transactions t
join public.chart_of_accounts c on c.id = t.category_id
where t.category_id is not null
  and t.type in ('income', 'expense')
  and c.nature = t.type
  and btrim(t.description) <> ''
on conflict (organization_id, normalized_description, transaction_type)
do update set
  sample_description = excluded.sample_description,
  category_id = excluded.category_id,
  confidence = excluded.confidence,
  last_used_at = excluded.last_used_at,
  updated_at = now();
