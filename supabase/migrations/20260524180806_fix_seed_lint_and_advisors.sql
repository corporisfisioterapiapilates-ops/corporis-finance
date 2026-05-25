-- Corrige lint do plpgsql_check em seed_corporis_chart removendo temp table
-- interna e resolve advisors antigos de search_path/policy initplan.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "profiles_self_access" on public.profiles;
create policy "profiles_self_access" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create or replace function public.seed_corporis_chart(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with seed(code, parent_code, name, nature, dfc_group, disp) as (
    values
      ('1'::text, null::text, 'Receita Bruta', 'calculated', 'operational', 100),
      ('1.01', '1', 'Pilates', 'income', 'operational', 101),
      ('1.02', '1', 'Fisioterapia', 'income', 'operational', 102),
      ('1.03', '1', 'Fisio Pélvica', 'income', 'operational', 103),
      ('1.04', '1', 'Taping', 'income', 'operational', 104),
      ('1.05', '1', 'Primeira Consulta', 'income', 'operational', 105),
      ('1.06', '1', 'Combo', 'income', 'operational', 106),
      ('2', null, 'Impostos sobre a Receita', 'calculated', 'operational', 200),
      ('2.01', '2', 'Simples Nacional', 'expense', 'operational', 201),
      ('2.02', '2', 'DARF', 'expense', 'operational', 202),
      ('3', null, 'Custos', 'calculated', 'operational', 300),
      ('3.02', '3', 'Lavanderia', 'expense', 'operational', 302),
      ('3.03', '3', 'Materiais Fisio', 'expense', 'operational', 303),
      ('3.99', '3', 'Outros custos', 'expense', 'operational', 399),
      ('4', null, 'Despesas Operacionais', 'calculated', 'operational', 400),
      ('4.01', '4', 'Despesas com RH', 'calculated', 'operational', 410),
      ('4.01.01', '4.01', 'Salário', 'expense', 'operational', 411),
      ('4.01.02', '4.01', 'Transporte', 'expense', 'operational', 412),
      ('4.01.03', '4.01', 'Alimentação', 'expense', 'operational', 413),
      ('4.01.04', '4.01', 'Bônus', 'expense', 'operational', 414),
      ('4.01.05', '4.01', 'Confraternizações', 'expense', 'operational', 415),
      ('4.01.06', '4.01', 'FGTS', 'expense', 'operational', 416),
      ('4.01.07', '4.01', 'INSS Patronal', 'expense', 'operational', 417),
      ('4.01.08', '4.01', 'Férias', 'expense', 'operational', 418),
      ('4.01.09', '4.01', 'Rescisão', 'expense', 'operational', 419),
      ('4.01.10', '4.01', '13º salário', 'expense', 'operational', 420),
      ('4.01.11', '4.01', 'Hora Extra', 'expense', 'operational', 421),
      ('4.01.12', '4.01', 'Treinamento', 'expense', 'operational', 422),
      ('4.01.13', '4.01', 'Pró-labore', 'expense', 'operational', 423),
      ('4.01.99', '4.01', 'Outras despesas com RH', 'expense', 'operational', 424),
      ('4.02', '4', 'Despesas Administrativas', 'calculated', 'operational', 430),
      ('4.02.01', '4.02', 'Aluguel e Condomínio', 'expense', 'operational', 431),
      ('4.02.02', '4.02', 'Luz/Água/Gás', 'expense', 'operational', 432),
      ('4.02.03', '4.02', 'Telefone e Internet', 'expense', 'operational', 433),
      ('4.02.04', '4.02', 'Contador', 'expense', 'operational', 434),
      ('4.02.05', '4.02', 'Taxas Burocráticas', 'expense', 'operational', 435),
      ('4.02.06', '4.02', 'Taxas Bancárias', 'expense', 'operational', 436),
      ('4.02.07', '4.02', 'Sistemas', 'expense', 'operational', 437),
      ('4.02.08', '4.02', 'Manutenção', 'expense', 'operational', 438),
      ('4.02.09', '4.02', 'Material Limpeza', 'expense', 'operational', 439),
      ('4.02.10', '4.02', 'Material Escritório', 'expense', 'operational', 440),
      ('4.02.11', '4.02', 'Viagens a negócio', 'expense', 'operational', 441),
      ('4.02.12', '4.02', 'Faxina/Limpeza', 'expense', 'operational', 442),
      ('4.02.13', '4.02', 'Cursos', 'expense', 'operational', 443),
      ('4.02.14', '4.02', 'Estacionamento', 'expense', 'operational', 444),
      ('4.02.15', '4.02', 'Consultoria', 'expense', 'operational', 445),
      ('4.02.16', '4.02', 'Mercado', 'expense', 'operational', 446),
      ('4.02.17', '4.02', 'Utensílios', 'expense', 'operational', 447),
      ('4.02.99', '4.02', 'Outras despesas administrativas', 'expense', 'operational', 448),
      ('4.03', '4', 'Despesas com Vendas', 'calculated', 'operational', 450),
      ('4.03.01', '4.03', 'Site', 'expense', 'operational', 451),
      ('4.03.02', '4.03', 'Comissão sobre Vendas', 'expense', 'operational', 452),
      ('4.03.03', '4.03', 'Taxas de Meio de Pagamento', 'expense', 'operational', 453),
      ('4.03.04', '4.03', 'Taxa de Boletos', 'expense', 'operational', 454),
      ('4.03.05', '4.03', 'Logística', 'expense', 'operational', 455),
      ('4.03.06', '4.03', 'Combustível', 'expense', 'operational', 456),
      ('4.03.07', '4.03', 'Assessoria de Marketing', 'expense', 'operational', 457),
      ('4.03.08', '4.03', 'Assessoria de Imprensa', 'expense', 'operational', 458),
      ('4.03.09', '4.03', 'Despesa com Mídia', 'expense', 'operational', 459),
      ('4.03.99', '4.03', 'Outras despesas com vendas', 'expense', 'operational', 460),
      ('5', null, 'Receita / Despesa Financeira', 'calculated', 'non_operational', 500),
      ('5.01', '5', 'Receita Financeira', 'income', 'non_operational', 501),
      ('5.02', '5', 'Despesa Financeira', 'expense', 'non_operational', 502),
      ('6', null, 'Resultado Não Operacional', 'calculated', 'non_operational', 600),
      ('6.01', '6', 'Receitas Não Operacionais', 'income', 'non_operational', 601),
      ('6.02', '6', 'Despesas Não Operacionais', 'expense', 'non_operational', 602),
      ('7', null, 'Investimento', 'calculated', 'investment', 700),
      ('7.01', '7', 'Obras Estruturais', 'expense', 'investment', 701),
      ('7.02', '7', 'Compra Máquinas e Equipamentos', 'expense', 'investment', 702),
      ('7.03', '7', 'Compra Materiais de serviço', 'expense', 'investment', 703),
      ('7.04', '7', 'Compra Escritório', 'expense', 'investment', 704),
      ('7.05', '7', 'Investimento em Mídia e Marketing', 'expense', 'investment', 705),
      ('7.06', '7', 'Investimento em Software', 'expense', 'investment', 706),
      ('7.99', '7', 'Outros investimentos', 'expense', 'investment', 799),
      ('8', null, 'Financeiro', 'calculated', 'financing', 800),
      ('8.01', '8', 'Aumento Dívida', 'income', 'financing', 801),
      ('8.02', '8', 'Pagamento Dívida', 'expense', 'financing', 802),
      ('8.03', '8', 'Aporte Sócios', 'income', 'financing', 803),
      ('8.04', '8', 'Pagamento Dividendos', 'expense', 'financing', 804)
  )
  insert into public.chart_of_accounts
    (organization_id, code, name, nature, dfc_group, display_order)
  select p_org, seed.code, seed.name, seed.nature, seed.dfc_group, seed.disp
  from seed;

  with seed(code, parent_code) as (
    values
      ('1'::text, null::text),
      ('1.01', '1'),
      ('1.02', '1'),
      ('1.03', '1'),
      ('1.04', '1'),
      ('1.05', '1'),
      ('1.06', '1'),
      ('2', null),
      ('2.01', '2'),
      ('2.02', '2'),
      ('3', null),
      ('3.02', '3'),
      ('3.03', '3'),
      ('3.99', '3'),
      ('4', null),
      ('4.01', '4'),
      ('4.01.01', '4.01'),
      ('4.01.02', '4.01'),
      ('4.01.03', '4.01'),
      ('4.01.04', '4.01'),
      ('4.01.05', '4.01'),
      ('4.01.06', '4.01'),
      ('4.01.07', '4.01'),
      ('4.01.08', '4.01'),
      ('4.01.09', '4.01'),
      ('4.01.10', '4.01'),
      ('4.01.11', '4.01'),
      ('4.01.12', '4.01'),
      ('4.01.13', '4.01'),
      ('4.01.99', '4.01'),
      ('4.02', '4'),
      ('4.02.01', '4.02'),
      ('4.02.02', '4.02'),
      ('4.02.03', '4.02'),
      ('4.02.04', '4.02'),
      ('4.02.05', '4.02'),
      ('4.02.06', '4.02'),
      ('4.02.07', '4.02'),
      ('4.02.08', '4.02'),
      ('4.02.09', '4.02'),
      ('4.02.10', '4.02'),
      ('4.02.11', '4.02'),
      ('4.02.12', '4.02'),
      ('4.02.13', '4.02'),
      ('4.02.14', '4.02'),
      ('4.02.15', '4.02'),
      ('4.02.16', '4.02'),
      ('4.02.17', '4.02'),
      ('4.02.99', '4.02'),
      ('4.03', '4'),
      ('4.03.01', '4.03'),
      ('4.03.02', '4.03'),
      ('4.03.03', '4.03'),
      ('4.03.04', '4.03'),
      ('4.03.05', '4.03'),
      ('4.03.06', '4.03'),
      ('4.03.07', '4.03'),
      ('4.03.08', '4.03'),
      ('4.03.09', '4.03'),
      ('4.03.99', '4.03'),
      ('5', null),
      ('5.01', '5'),
      ('5.02', '5'),
      ('6', null),
      ('6.01', '6'),
      ('6.02', '6'),
      ('7', null),
      ('7.01', '7'),
      ('7.02', '7'),
      ('7.03', '7'),
      ('7.04', '7'),
      ('7.05', '7'),
      ('7.06', '7'),
      ('7.99', '7'),
      ('8', null),
      ('8.01', '8'),
      ('8.02', '8'),
      ('8.03', '8'),
      ('8.04', '8')
  ),
  links as (
    select child.id as child_id, parent.id as parent_id
    from seed
    join public.chart_of_accounts child
      on child.organization_id = p_org
     and child.code = seed.code
    join public.chart_of_accounts parent
      on parent.organization_id = p_org
     and parent.code = seed.parent_code
    where seed.parent_code is not null
  )
  update public.chart_of_accounts chart
     set parent_id = links.parent_id
    from links
   where chart.id = links.child_id;
end;
$$;

revoke all on function public.seed_corporis_chart(uuid) from public;
