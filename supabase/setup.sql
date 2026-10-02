-- CSPERFUMES v15 - instalación limpia. Si tu Supabase actual ya tiene products,
-- ejecuta solamente migrations/20261001_dynamic_catalog.sql.
create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  brand text not null,
  name text not null,
  type text not null default '',
  category text not null,
  gender text not null check (gender in ('hombre','mujer','unisex')),
  image_url text not null,
  image_path text null,
  status text not null default 'available' check (status in ('available','sold_out','hidden')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_status_idx on public.products(status);
create index if not exists products_sort_order_idx on public.products(sort_order);
create unique index if not exists products_one_featured_per_category_idx on public.products(category) where featured=true;

create table if not exists public.catalog_categories (
  slug text primary key,label text not null unique,eyebrow text,title text,line text,description text,word text,
  theme text not null default 'noir' check (theme in ('noir','noir-soft','gold','rose')),
  cover_image_url text,cover_image_path text,sort_order integer not null default 0,visible boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.catalog_brands (name text primary key,sort_order integer not null default 0,created_at timestamptz not null default now());
create table if not exists public.catalog_types (name text primary key,sort_order integer not null default 0,created_at timestamptz not null default now());

insert into public.catalog_categories(slug,label,eyebrow,title,line,description,word,theme,sort_order) values
('disenador','Diseñador','Casas de diseñador','Perfumes de diseñador','Firmas icónicas, composiciones reconocibles y presencia elegante.','Una selección de firmas internacionales.','DESIGNER','noir',10),
('arabes','Árabe','Perfumería árabe','Perfumes árabes','Oud, ámbar, especias y composiciones con mucha presencia.','Fragancias intensas y distintivas.','OUD','gold',20),
('americanos','Americanos','Colección Americanos','Catálogo Americanos','Una selección importada con perfiles frescos, elegantes y reconocibles.','Una colección independiente.','AMERICAN','noir-soft',30)
on conflict(slug) do nothing;

insert into public.catalog_types(name,sort_order) values
('Eau de Toilette',1),('Eau de Parfum',2),('Parfum',3),('Extrait de Parfum',4),('Elixir',5),('Cologne',6),('Body Mist',7),('Colección',8),('Varios modelos',9),('Luxury Collection · Eau de Parfum',10),('Otro',11)
on conflict(name) do nothing;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='products_category_fk' and conrelid='public.products'::regclass) then
    alter table public.products add constraint products_category_fk foreign key(category) references public.catalog_categories(slug) on update cascade on delete restrict;
  end if;
end $$;

create or replace function public.set_products_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end;$$;
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_products_updated_at();
create or replace function public.set_catalog_category_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end;$$;
drop trigger if exists catalog_categories_set_updated_at on public.catalog_categories;
create trigger catalog_categories_set_updated_at before update on public.catalog_categories for each row execute function public.set_catalog_category_updated_at();

alter table public.products enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_brands enable row level security;
alter table public.catalog_types enable row level security;
revoke all on table public.products from anon,authenticated;
revoke all on table public.catalog_categories from anon,authenticated;
revoke all on table public.catalog_brands from anon,authenticated;
revoke all on table public.catalog_types from anon,authenticated;

-- Storage público para nuevas imágenes del admin.
insert into storage.buckets(id,name,public) values('product-images','product-images',true)
on conflict(id) do update set public=true;
