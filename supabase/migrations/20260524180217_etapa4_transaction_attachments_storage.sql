-- ETAPA 4 — Storage privado para anexos de lançamentos
-- Bucket privado: cada objeto fica em organization_id/transaction_id/filename.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'transaction-attachments',
  'transaction-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/csv',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "transaction_attachments_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'transaction-attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  );

create policy "transaction_attachments_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'transaction-attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  );

create policy "transaction_attachments_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'transaction-attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  )
  with check (
    bucket_id = 'transaction-attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  );

create policy "transaction_attachments_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'transaction-attachments'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
  );
