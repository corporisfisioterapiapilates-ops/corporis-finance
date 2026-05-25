-- ETAPA 4 — Transferências atômicas
-- Liga as duas linhas de uma transferência e cria RPC para inserir ambas na mesma transação SQL.

alter table public.transactions
  add column transfer_group_id uuid;

create index transactions_organization_transfer_group_idx
  on public.transactions(organization_id, transfer_group_id)
  where transfer_group_id is not null;

create or replace function public.create_manual_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_description text,
  p_event_date date,
  p_cash_date date,
  p_status text default 'cleared',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.auth_org_id();
  v_group_id uuid := gen_random_uuid();
begin
  if v_org_id is null then
    raise exception 'Não autenticado';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'As contas da transferência precisam ser diferentes';
  end if;
  if p_amount <= 0 then
    raise exception 'O valor precisa ser maior que zero';
  end if;
  if p_status not in ('pending', 'cleared') then
    raise exception 'Status inválido';
  end if;
  if not exists (
    select 1 from public.accounts
    where id = p_from_account_id and organization_id = v_org_id
  ) then
    raise exception 'Conta de origem inválida';
  end if;
  if not exists (
    select 1 from public.accounts
    where id = p_to_account_id and organization_id = v_org_id
  ) then
    raise exception 'Conta de destino inválida';
  end if;

  insert into public.transactions (
    organization_id, account_id, counter_account_id, type, amount,
    description, event_date, cash_date, status, source, notes, transfer_group_id
  )
  values
    (
      v_org_id, p_from_account_id, p_to_account_id, 'transfer', p_amount,
      p_description, p_event_date, p_cash_date, p_status, 'manual', p_notes, v_group_id
    ),
    (
      v_org_id, p_to_account_id, p_from_account_id, 'transfer', p_amount,
      p_description, p_event_date, p_cash_date, p_status, 'manual', p_notes, v_group_id
    );

  return v_group_id;
end;
$$;

revoke all on function public.create_manual_transfer(uuid, uuid, numeric, text, date, date, text, text)
  from public;
grant execute on function public.create_manual_transfer(uuid, uuid, numeric, text, date, date, text, text)
  to authenticated;
