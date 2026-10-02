-- CSPERFUMES V20 - endurecimiento del backend para instalaciones existentes.
-- Es idempotente: se puede ejecutar aunque 20261001 ya haya sido aplicada.

alter table if exists public.products
  add column if not exists image_path text null;

alter table if exists public.catalog_categories
  add column if not exists cover_image_url text null;

alter table if exists public.catalog_categories
  add column if not exists cover_image_path text null;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Confirma que las piezas mínimas del backend existen.
do $$
begin
  if to_regclass('public.products') is null then
    raise exception 'Falta public.products. Ejecuta supabase/setup.sql para una instalación limpia.';
  end if;
  if to_regclass('public.catalog_categories') is null
     or to_regclass('public.catalog_brands') is null
     or to_regclass('public.catalog_types') is null then
    raise exception 'Faltan tablas del catálogo dinámico. Ejecuta primero 20261001_dynamic_catalog.sql.';
  end if;
end $$;
