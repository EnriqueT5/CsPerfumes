# CSPERFUMES V20

# CSPERFUMES v15 - proyecto completo

Este ZIP sí es la raíz completa del proyecto para reemplazar el contenido del repo y dejar que Netlify despliegue desde GitHub.

## Antes del primer deploy de esta versión

1. En Supabase > SQL Editor ejecuta `supabase/migrations/20261001_dynamic_catalog.sql` si tu base actual ya existe.
2. Las variables de Netlify se mantienen con los mismos nombres: `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. No hay secretos escritos en el repo.
3. Reemplaza el contenido del repo por el contenido de esta carpeta, commit/push y Netlify desplegará `site/`.


## V20 - persistencia 100% servidor

- Se eliminó el fallback de categorías, marcas y tipos en `localStorage`.
- El administrador ahora exige `/api/admin/options`; si el backend no está disponible muestra el error real en vez de simular un guardado local.
- Para instalaciones existentes, ejecutar también `supabase/migrations/20261002_backend_storage_hardening.sql`.
- Esa migración garantiza `products.image_path`, campos de portada y el bucket público `product-images`.
- Perfumes, categorías, marcas, tipos e imágenes nuevas quedan centralizados en Supabase y son compartidos entre navegadores/equipos.

## Imágenes

- Las imágenes nuevas del administrador siguen subiendo a Supabase Storage y guardan `image_path`.
- Las imágenes históricas no consumen Supabase. Si la BD aún contiene rutas tipo `/assets/images/...`, la API las resuelve automáticamente contra el commit histórico de GitHub donde ya existen.
- Al eliminar o reemplazar una imagen, solo se borra de Supabase cuando el registro tiene `image_path`. Las históricas quedan intactas.

## Cambios principales

- Index incluido y dinámico.
- Navbar y menú móvil se generan desde las categorías de Supabase.
- Botón pequeño `Iniciar sesión` hacia `admin.html`.
- Nuevas categorías aparecen automáticamente en el index y usan como portada el perfume destacado; no hace falta crear otro HTML.
- `Marca`, `Tipo / concentración` y `Categoría` son combos administrables.
- Orden acepta cualquier entero desde 0, incluido 1 o 5.
- Overlay bloqueante visible durante optimización/subida/guardado/eliminación.
- Página genérica: `pages/categoria.html?categoria=slug`.

## Estructura

- `site/`: frontend público + admin.
- `netlify/functions/`: API serverless.
- `netlify/lib/`: autenticación, Supabase y validación.
- `supabase/`: SQL de instalación/migración.

## Correcciones v16

- Menú móvil corregido: las categorías se muestran en filas independientes y ya no se concatenan.
- Navbar y textos principales con mayor tamaño/contraste en escritorio.
- Icono flotante de WhatsApp restaurado con SVG real.
- Catálogos individuales rediseñados: encabezado editorial, contador, filtros, tarjetas con mejor jerarquía visual y fallback si una imagen histórica no carga.
- Combos del editor de producto rediseñados con menú oscuro propio, selección dorada y experiencia móvil sin el desplegable nativo gigante.
## V19 - estrategia de imágenes

CSPERFUMES usa dos orígenes de imagen al mismo tiempo:

1. **Imágenes históricas:** archivos físicos bajo `site/assets/images/`.
   Deben estar versionados en este mismo repositorio de GitHub.
2. **Imágenes nuevas desde Admin:** se suben a Supabase Storage
   (`product-images`) y se guardan como URL HTTPS absoluta.

El código detecta ambos casos automáticamente.

Importante: no vuelvas a configurar un commit antiguo como base de imágenes.
Si el repo se elimina o cambia el SHA, todas las fotos volverían a morir.
