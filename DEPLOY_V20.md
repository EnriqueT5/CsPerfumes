# CSPERFUMES V20 - despliegue

## 1. Supabase

Si la base ya existe, ejecuta en **Supabase > SQL Editor**, en este orden:

1. `supabase/migrations/20261001_dynamic_catalog.sql`
2. `supabase/migrations/20261002_backend_storage_hardening.sql`

La segunda migración es idempotente y corrige instalaciones que ya tenían la primera migración aplicada.

Si es una instalación nueva, puedes ejecutar `supabase/setup.sql` y luego la migración de hardening.

## 2. Variables en Netlify

Configura estas variables en **Site configuration > Environment variables**:

- `ADMIN_PASSWORD`
- `SESSION_SECRET` (mínimo 32 caracteres)
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=product-images` (opcional; ese es el valor por defecto)

No coloques la clave secreta de Supabase en archivos JavaScript del frontend.

## 3. Deploy

Sube el contenido de este paquete a la raíz del repositorio y despliega desde GitHub en Netlify.

La publicación debe usar:

- Publish directory: `site`
- Functions directory: `netlify/functions`

`netlify.toml` ya contiene esta configuración.

## 4. Verificación

1. Abre `/admin.html` e inicia sesión.
2. Crea una categoría desde **Administrar listas**.
3. Recarga desde otro navegador/equipo: la categoría debe seguir disponible.
4. Crea un perfume con imagen.
5. Confirma en Supabase:
   - fila nueva en `public.products`;
   - categoría en `public.catalog_categories`;
   - imagen en Storage > `product-images`.
6. Abre la página pública y confirma que el producto aparece sin depender del navegador donde fue creado.

## Cambio principal

La versión V20 ya no usa `localStorage` como respaldo para categorías, marcas o tipos. Si el backend no está disponible, el administrador muestra el error real y no simula un guardado local.
