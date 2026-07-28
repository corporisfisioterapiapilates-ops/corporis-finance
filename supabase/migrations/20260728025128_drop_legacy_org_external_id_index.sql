-- Remove uma versão legada do índice de FITID criada diretamente no banco
-- remoto. O índice por conta foi criado na migração anterior.
drop index if exists public.transactions_org_source_external_uidx;
