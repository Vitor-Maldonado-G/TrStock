create table if not exists public.replenishments (
  product_id uuid primary key references public.products(id) on delete cascade,
  status text not null check (status in ('ordered', 'received')),
  note text,
  ordered_by uuid references public.profiles(id),
  ordered_at timestamptz,
  received_by uuid references public.profiles(id),
  received_at timestamptz,
  received_quantity numeric
);

alter table public.replenishments enable row level security;

drop policy if exists "tr_replenishments_manager" on public.replenishments;
create policy "tr_replenishments_manager" on public.replenishments
for all to authenticated
using (public.is_gerente())
with check (public.is_gerente());

create or replace function public.receive_replenishment(
  p_product_id uuid,
  p_quantity numeric,
  p_note text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_gerente() then
    raise exception 'Apenas gerentes podem confirmar reposições';
  end if;

  if p_quantity < 0 then
    raise exception 'A quantidade recebida não pode ser negativa';
  end if;

  if not exists (
    select 1 from public.replenishments
    where product_id = p_product_id and status = 'ordered'
  ) then
    raise exception 'Não existe reposição aguardando recebimento para este produto';
  end if;

  insert into public.counts (product_id, quantity, note, counted_by)
  values (p_product_id, p_quantity, coalesce(nullif(trim(p_note), ''), 'Reposição recebida.'), auth.uid());

  update public.replenishments
  set status = 'received',
      note = coalesce(nullif(trim(p_note), ''), note),
      received_by = auth.uid(),
      received_at = now(),
      received_quantity = p_quantity
  where product_id = p_product_id and status = 'ordered';
end;
$$;

revoke all on function public.receive_replenishment(uuid, numeric, text) from public;
grant execute on function public.receive_replenishment(uuid, numeric, text) to authenticated;
