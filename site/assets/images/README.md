# Imágenes históricas de CSPERFUMES

Esta carpeta se publica directamente desde GitHub/Netlify.

## Estructura esperada

```text
site/assets/images/
├── prod_01.jpg ... prod_11.jpg
├── designer/
│   └── designer_01.jpeg ...
├── arabic/
│   └── arabic_01.jpeg ...
├── americanos/
│   └── americanos_01.jpeg ...
└── brand/
    └── cs-perfumes-background.png
```

Los productos históricos pueden guardar en Supabase valores como:

- `assets/images/prod_01.jpg`
- `/assets/images/designer/designer_01.jpeg`
- una URL vieja de `raw.githubusercontent.com/.../site/assets/images/...`

El frontend y las Netlify Functions normalizan esos tres formatos a
`/assets/images/...`, por lo que las fotos se sirven desde ESTE repo.

Las imágenes nuevas cargadas desde el administrador NO se guardan aquí:
se suben al bucket público `product-images` de Supabase Storage y su
`image_url` absoluta se usa directamente.
