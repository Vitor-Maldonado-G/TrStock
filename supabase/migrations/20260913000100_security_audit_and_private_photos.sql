-- Segurança, auditoria e fotos privadas do TR Stock.

alter table public.products
  add column if not exists count_by_photo boolean not null default false,
  add column if not exists is_market_item boolean not null default false;

alter table public.counts
  add column if not exists photo_url text,
  add column if not exists photo_path text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles(id),
  add column if not exists void_reason text;

update public.counts
set photo_path = regexp_replace(photo_url, '^.*/fotos-contagem/', '')
where photo_path is null and photo_url like '%/fotos-contagem/%';

create index if not exists counts_product_counted_at_idx on public.counts (product_id, counted_at desc);
create index if not exists counts_active_counted_at_idx on public.counts (counted_at desc) where voided_at is null;

create or replace function public.is_gerente()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'gerente' and active = true
  );
$$;
revoke all on function public.is_gerente() from public;
grant execute on function public.is_gerente() to authenticated;

create or replace function public.set_count_void_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.voided_at is null and new.voided_at is not null then
    new.voided_at = coalesce(new.voided_at, now());
    new.voided_by = auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function public.set_count_void_audit() from public;
drop trigger if exists tr_set_count_void_audit on public.counts;
create trigger tr_set_count_void_audit before update on public.counts
for each row execute function public.set_count_void_audit();

create or replace function public.save_product_with_categories(
  p_product_id uuid, p_name text, p_unit text, p_min_quantity numeric,
  p_count_by_photo boolean, p_is_market_item boolean, p_category_ids uuid[]
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_product_id uuid;
begin
  if not public.is_gerente() then
    raise exception 'Apenas gerentes podem salvar produtos.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Nome do produto é obrigatório.'; end if;
  if p_min_quantity < 0 then raise exception 'Quantidade mínima não pode ser negativa.'; end if;
  if coalesce(cardinality(p_category_ids), 0) = 0 then raise exception 'Selecione pelo menos uma categoria.'; end if;
  if p_product_id is null then
    insert into public.products (name, unit, min_quantity, count_by_photo, is_market_item)
    values (trim(p_name), p_unit, p_min_quantity, coalesce(p_count_by_photo, false), coalesce(p_is_market_item, false))
    returning id into v_product_id;
  else
    update public.products set name = trim(p_name), unit = p_unit, min_quantity = p_min_quantity,
      count_by_photo = coalesce(p_count_by_photo, false), is_market_item = coalesce(p_is_market_item, false)
    where id = p_product_id returning id into v_product_id;
    if v_product_id is null then raise exception 'Produto não encontrado.' using errcode = 'P0002'; end if;
    delete from public.product_categories where product_id = v_product_id;
  end if;
  insert into public.product_categories(product_id, category_id)
  select v_product_id, category_id from unnest(p_category_ids) as category_id on conflict do nothing;
  return v_product_id;
end;
$$;
revoke all on function public.save_product_with_categories(uuid, text, text, numeric, boolean, boolean, uuid[]) from public;
grant execute on function public.save_product_with_categories(uuid, text, text, numeric, boolean, boolean, uuid[]) to authenticated;

insert into storage.buckets (id, name, public) values ('fotos-contagem', 'fotos-contagem', false)
on conflict (id) do update set public = false;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.counts enable row level security;

-- Remove as regras antigas, que eram permissivas demais, antes de criar as novas.
drop policy if exists "gerente gerencia categorias" on public.categories;
drop policy if exists "logados veem categorias" on public.categories;
drop policy if exists "Gerente pode deletar contagens" on public.counts;
drop policy if exists "contador insere sua própria contagem" on public.counts;
drop policy if exists "gerente gerencia contagens" on public.counts;
drop policy if exists "logados veem contagens" on public.counts;
drop policy if exists "gerente gerencia vínculos produto-categoria" on public.product_categories;
drop policy if exists "logados veem vínculos produto-categoria" on public.product_categories;
drop policy if exists "gerente gerencia produtos" on public.products;
drop policy if exists "logados veem produtos" on public.products;
drop policy if exists "gerente vê e gerencia perfis" on public.profiles;
drop policy if exists "usuário vê o próprio perfil" on public.profiles;
drop policy if exists "Leitura pública fotos-contagem" on storage.objects;

drop policy if exists "tr_profiles_self_or_manager" on public.profiles;
create policy "tr_profiles_self_or_manager" on public.profiles for select to authenticated using (id = auth.uid() or public.is_gerente());
drop policy if exists "tr_profiles_manager_write" on public.profiles;
create policy "tr_profiles_manager_write" on public.profiles for update to authenticated using (public.is_gerente()) with check (public.is_gerente());

drop policy if exists "tr_categories_read" on public.categories;
create policy "tr_categories_read" on public.categories for select to authenticated using (true);
drop policy if exists "tr_categories_manager_write" on public.categories;
create policy "tr_categories_manager_write" on public.categories for all to authenticated using (public.is_gerente()) with check (public.is_gerente());

drop policy if exists "tr_products_read" on public.products;
create policy "tr_products_read" on public.products for select to authenticated using (active or public.is_gerente());
drop policy if exists "tr_products_manager_write" on public.products;
create policy "tr_products_manager_write" on public.products for all to authenticated using (public.is_gerente()) with check (public.is_gerente());

drop policy if exists "tr_product_categories_read" on public.product_categories;
create policy "tr_product_categories_read" on public.product_categories for select to authenticated using (true);
drop policy if exists "tr_product_categories_manager_write" on public.product_categories;
create policy "tr_product_categories_manager_write" on public.product_categories for all to authenticated using (public.is_gerente()) with check (public.is_gerente());

drop policy if exists "tr_counts_read" on public.counts;
create policy "tr_counts_read" on public.counts for select to authenticated using (counted_by = auth.uid() or public.is_gerente());
drop policy if exists "tr_counts_insert" on public.counts;
create policy "tr_counts_insert" on public.counts for insert to authenticated with check (counted_by = auth.uid());
drop policy if exists "tr_counts_manager_update" on public.counts;
create policy "tr_counts_manager_update" on public.counts for update to authenticated using (public.is_gerente()) with check (public.is_gerente());

drop policy if exists "tr_count_photos_read" on storage.objects;
create policy "tr_count_photos_read" on storage.objects for select to authenticated
using (bucket_id = 'fotos-contagem' and (owner_id = auth.uid()::text or public.is_gerente()));
drop policy if exists "tr_count_photos_insert" on storage.objects;
create policy "tr_count_photos_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'fotos-contagem' and owner_id = auth.uid()::text);
drop policy if exists "tr_count_photos_delete" on storage.objects;
create policy "tr_count_photos_delete" on storage.objects for delete to authenticated
using (bucket_id = 'fotos-contagem' and (owner_id = auth.uid()::text or public.is_gerente()));

-- Mostra apenas o aviso necessário para evitar dupla contagem no mesmo dia.
create or replace function public.today_counts_for_products(
  p_product_ids uuid[],
  p_from timestamptz
)
returns table (
  product_id uuid,
  quantity numeric,
  counted_at timestamptz,
  counter_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.product_id, c.quantity, c.counted_at, p.name
  from public.counts c
  join public.profiles p on p.id = c.counted_by
  where c.product_id = any(p_product_ids)
    and c.counted_at >= p_from
    and c.voided_at is null
  order by c.counted_at desc;
$$;

revoke all on function public.today_counts_for_products(uuid[], timestamptz) from public;
grant execute on function public.today_counts_for_products(uuid[], timestamptz) to authenticated;
