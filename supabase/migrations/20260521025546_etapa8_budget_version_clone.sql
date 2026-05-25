-- ETAPA 8 — Criação atômica de nova versão de orçamento
-- Arquiva a versão ativa do ano, cria uma nova versão ativa e herda os valores da versão-base.

create or replace function public.create_budget_version(
  p_year int,
  p_name text,
  p_source_version_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.auth_org_id();
  v_source_version_id uuid;
  v_new_version_id uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_org_id is null then
    raise exception 'Não autenticado';
  end if;

  if p_year < 2000 or p_year > 2100 then
    raise exception 'Ano inválido';
  end if;

  if v_name is null or length(v_name) > 80 then
    raise exception 'Nome da versão inválido';
  end if;

  if p_source_version_id is not null then
    select id
      into v_source_version_id
    from public.budget_versions
    where id = p_source_version_id
      and organization_id = v_org_id
      and year = p_year;

    if v_source_version_id is null then
      raise exception 'Versão base inválida';
    end if;
  else
    select id
      into v_source_version_id
    from public.budget_versions
    where organization_id = v_org_id
      and year = p_year
      and status = 'active'
    limit 1;
  end if;

  insert into public.budget_versions (organization_id, year, name, status)
  values (v_org_id, p_year, v_name, 'archived')
  returning id into v_new_version_id;

  if v_source_version_id is not null then
    insert into public.budget_values (
      organization_id,
      budget_version_id,
      chart_account_id,
      month,
      amount
    )
    select
      v_org_id,
      v_new_version_id,
      chart_account_id,
      month,
      amount
    from public.budget_values
    where organization_id = v_org_id
      and budget_version_id = v_source_version_id;
  end if;

  update public.budget_versions
    set status = 'archived'
  where organization_id = v_org_id
    and year = p_year
    and status = 'active';

  update public.budget_versions
    set status = 'active'
  where id = v_new_version_id
    and organization_id = v_org_id;

  return v_new_version_id;
end;
$$;

revoke all on function public.create_budget_version(int, text, uuid)
  from public;
grant execute on function public.create_budget_version(int, text, uuid)
  to authenticated;
