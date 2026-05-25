-- Limpeza operacional para preparar a Corporis Finance como app single-clinic.
--
-- Preserva:
-- - auth.users
-- - public.organizations
-- - public.profiles
-- - public.accounts (mantem contas, mas zera saldos/limites iniciais)
-- - public.chart_of_accounts
--
-- Remove dados demonstrativos/transacionais:
-- - lancamentos e anexos
-- - importacoes e faturas de cartao
-- - orcamentos
-- - historico do consultor IA
-- - memoria de categorizacao
-- - notificacoes
--
-- Uso local via container do Supabase:
--   docker exec -i supabase_db_fin-corporis psql -U postgres -d postgres < scripts/prepare-single-clinic.sql
--
-- Uso remoto, quando voce tiver certeza:
--   cole este arquivo no SQL Editor do Supabase ou rode com psql usando a
--   connection string do banco remoto.

begin;

-- Observacao: o Supabase bloqueia delete direto em storage.objects.
-- Se existirem arquivos no bucket transaction-attachments, esvazie pelo Studio
-- ou pela Storage API antes/depois deste script.

delete from public.notifications;
delete from public.ai_messages;
delete from public.ai_conversations;
delete from public.category_memory;
delete from public.budget_values;
delete from public.budget_versions;
delete from public.attachments;
delete from public.transactions;
delete from public.credit_card_invoices;
delete from public.imports;

update public.accounts
set
  opening_balance = 0,
  opening_balance_date = null,
  credit_limit = null,
  updated_at = now();

do $$
begin
  if (select count(*) from public.organizations) = 1 then
    update public.organizations
    set
      name = 'Corporis Fisioterapia & Pilates',
      slug = 'corporis',
      locale = 'pt-BR',
      timezone = 'America/Sao_Paulo',
      currency = 'BRL',
      updated_at = now();
  end if;
end;
$$;

commit;

select
  (select count(*) from public.organizations) as organizations,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.accounts) as accounts,
  (select count(*) from public.chart_of_accounts) as chart_accounts,
  (select count(*) from public.transactions) as transactions,
  (select count(*) from public.imports) as imports,
  (select count(*) from public.credit_card_invoices) as credit_card_invoices,
  (select count(*) from public.budget_versions) as budget_versions,
  (select count(*) from public.notifications) as notifications,
  (select count(*) from public.ai_conversations) as ai_conversations,
  (select count(*) from public.category_memory) as category_memory,
  (select count(*) from storage.objects where bucket_id = 'transaction-attachments') as attachment_files;
