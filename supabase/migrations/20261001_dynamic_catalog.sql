-- CSPERFUMES - categorías, marcas y tipos dinámicos para Admin + futura sincronización Excel.
-- Ejecutar UNA VEZ en Supabase > SQL Editor antes de desplegar el código nuevo.

create table if not exists public.catalog_categories (
  slug text primary key,
  label text not null unique,
  eyebrow text null,
  title text null,
  line text null,
  description text null,
  word text null,
  theme text not null default 'noir' check (theme in ('noir','noir-soft','gold','rose')),
  cover_image_url text null,
  cover_image_path text null,
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_brands (
  name text primary key,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_types (
  name text primary key,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.catalog_categories (slug,label,eyebrow,title,line,description,word,theme,sort_order)
values
  ('disenador','Diseñador','Casas de diseñador','Perfumes de diseñador','Firmas icónicas, composiciones reconocibles y presencia elegante.','Una selección de firmas internacionales con un protagonista premium y acceso rápido al resto de la categoría.','DESIGNER','noir',10),
  ('arabes','Árabe','Perfumería árabe','Perfumes árabes','Oud, ámbar, especias y composiciones con mucha presencia.','Fragancias intensas y distintivas, organizadas alrededor de una pieza protagonista y una selección complementaria.','OUD','gold',20),
  ('americanos','Americanos','Colección Americanos','Catálogo Americanos','Una selección importada con perfiles frescos, elegantes y reconocibles.','Una colección independiente para los perfumes de la línea Americanos, con filtros internos para hombre y mujer.','AMERICAN','noir-soft',30)
on conflict (slug) do update set
  label = excluded.label,
  eyebrow = coalesce(public.catalog_categories.eyebrow, excluded.eyebrow),
  title = coalesce(public.catalog_categories.title, excluded.title),
  line = coalesce(public.catalog_categories.line, excluded.line),
  description = coalesce(public.catalog_categories.description, excluded.description),
  word = coalesce(public.catalog_categories.word, excluded.word),
  sort_order = excluded.sort_order;

insert into public.catalog_brands (name, sort_order)
select brand, min(sort_order)
from public.products
where nullif(trim(brand),'') is not null
group by brand
on conflict (name) do nothing;

insert into public.catalog_types (name, sort_order)
select type, min(sort_order)
from public.products
where nullif(trim(type),'') is not null
group by type
on conflict (name) do nothing;

insert into public.catalog_types (name, sort_order)
values
  ('Eau de Toilette',1),('Eau de Parfum',2),('Parfum',3),('Extrait de Parfum',4),
  ('Elixir',5),('Cologne',6),('Body Mist',7),('Colección',8),('Varios modelos',9),
  ('Luxury Collection · Eau de Parfum',10),('Otro',11)
on conflict (name) do nothing;

-- Compatibilidad con instalaciones anteriores del catálogo.
-- Las versiones viejas podían no tener trazabilidad de imágenes administradas.
alter table public.products add column if not exists image_path text null;
alter table public.catalog_categories add column if not exists cover_image_url text null;
alter table public.catalog_categories add column if not exists cover_image_path text null;

-- El administrador sube imágenes mediante Netlify Functions usando la clave secreta.
-- El bucket debe existir también cuando la base ya venía de una versión anterior.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- El CHECK anterior impedía cualquier categoría nueva.
alter table public.products drop constraint if exists products_category_check;

-- Garantiza que cada producto apunte a una categoría administrable.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_category_fk'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_category_fk
      foreign key (category) references public.catalog_categories(slug)
      on update cascade on delete restrict;
  end if;
end $$;

create index if not exists catalog_categories_sort_idx on public.catalog_categories(sort_order);
create index if not exists catalog_categories_visible_idx on public.catalog_categories(visible);

create or replace function public.set_catalog_category_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists catalog_categories_set_updated_at on public.catalog_categories;
create trigger catalog_categories_set_updated_at
before update on public.catalog_categories
for each row execute function public.set_catalog_category_updated_at();

-- Igual que products: las escrituras se realizan exclusivamente desde Netlify Functions.
alter table public.catalog_categories enable row level security;
alter table public.catalog_brands enable row level security;
alter table public.catalog_types enable row level security;
revoke all on table public.catalog_categories from anon, authenticated;
revoke all on table public.catalog_brands from anon, authenticated;
revoke all on table public.catalog_types from anon, authenticated;

select slug,label,sort_order,visible from public.catalog_categories order by sort_order,label;
