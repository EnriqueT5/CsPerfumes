\
    -- CSPERFUMES V19
    -- OPCIONAL: normaliza en BD las URLs del repositorio viejo a rutas locales.
    -- La aplicación V19 ya hace esta conversión en tiempo de ejecución, así que
    -- no es obligatorio ejecutar este archivo para que la web funcione.

    update public.products
    set image_url = regexp_replace(
      image_url,
      '^https://raw\.githubusercontent\.com/[^/]+/[^/]+/[^/]+/site/(assets/images/.*)$',
      '/\1'
    )
    where image_path is null
      and image_url ~ '^https://raw\.githubusercontent\.com/.+/site/assets/images/';

    update public.catalog_categories
    set cover_image_url = regexp_replace(
      cover_image_url,
      '^https://raw\.githubusercontent\.com/[^/]+/[^/]+/[^/]+/site/(assets/images/.*)$',
      '/\1'
    )
    where cover_image_path is null
      and cover_image_url ~ '^https://raw\.githubusercontent\.com/.+/site/assets/images/';
