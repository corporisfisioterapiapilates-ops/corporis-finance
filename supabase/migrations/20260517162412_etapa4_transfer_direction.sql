-- ETAPA 4 — Direção da transferência por linha
-- Necessário para exibir extrato por conta e calcular saldo corretamente.

alter table public.transactions
  add column if not exists transfer_direction text
  check (transfer_direction in ('out', 'in') or transfer_direction is null);

alter table public.transactions
  drop constraint if exists transactions_transfer_direction_check;

alter table public.transactions
  add constraint transactions_transfer_direction_check check (
    (type = 'transfer' and transfer_direction is not null)
    or (type in ('income', 'expense') and transfer_direction is null)
  );

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
    description, event_date, cash_date, status, source, notes, transfer_group_id,
    transfer_direction
  )
  values
    (
      v_org_id, p_from_account_id, p_to_account_id, 'transfer', p_amount,
      p_description, p_event_date, p_cash_date, p_status, 'manual', p_notes, v_group_id,
      'out'
    ),
    (
      v_org_id, p_to_account_id, p_from_account_id, 'transfer', p_amount,
      p_description, p_event_date, p_cash_date, p_status, 'manual', p_notes, v_group_id,
      'in'
    );

  return v_group_id;
end;
$$;
