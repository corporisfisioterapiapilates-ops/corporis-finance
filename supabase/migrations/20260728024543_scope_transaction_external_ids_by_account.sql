-- O FITID do OFX é único dentro da conta bancária, não dentro de toda a
-- organização. Contas diferentes podem receber o mesmo identificador do banco.
drop index if exists public.transactions_org_external_source_unique_idx;

create unique index transactions_account_external_source_unique_idx
  on public.transactions(organization_id, account_id, source, external_id)
  where external_id is not null;
