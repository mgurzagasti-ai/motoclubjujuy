# API Fix Notes

## Problema

La API de `motoclubjujuy` fallaba al consultar `GET /api/site-content` en produccion con un error equivalente a:

```txt
column site_content.settings does not exist
```

## Causa exacta

El codigo de la capa de almacenamiento estaba intentando leer y escribir la columna `public.site_content.settings` como si existiera siempre.

En algunos entornos productivos, la tabla `site_content` todavia existe sin esa columna, aunque el codigo mas nuevo ya la espera.

## Arreglo aplicado

Se actualizo [lib/site-content-store.ts](/abs/path/C:/Users/Martin/Desktop/motoclubjujuy/motoclubjujuy/lib/site-content-store.ts:32) para que:

- detecte errores reales de columna faltante (`42703`, `PGRST204`, y variantes del mensaje)
- haga fallback seguro en lectura si `settings` no existe
- haga fallback seguro en escritura omitiendo `settings` si la columna no existe
- use `maybeSingle()` para tolerar el caso en que la fila `slug = 'main'` todavia no exista

Con esto vuelven a funcionar los endpoints que dependen de `site_content`:

- `GET /api/site-content`
- `PUT /api/site-content`
- `GET /api/events`
- `POST /api/events`
- `PUT /api/events/:id`
- `GET /api/gallery`
- `POST /api/gallery`
- `PUT /api/gallery/:id`
- `GET /api/news`
- `POST /api/news`
- `PUT /api/news/:id`

## Migracion recomendada

Aunque el runtime ya tolera el esquema viejo, lo correcto es alinear produccion con el esquema esperado.

SQL recomendado:

```sql
alter table public.site_content
add column if not exists settings jsonb not null default '{}'::jsonb;

update public.site_content
set settings = '{}'::jsonb
where settings is null;
```

Este SQL tambien esta disponible en:

- [scripts/supabase-site-content-settings-migration.sql](/abs/path/C:/Users/Martin/Desktop/motoclubjujuy/motoclubjujuy/scripts/supabase-site-content-settings-migration.sql:1)

## Seguridad del cambio

La migracion es segura para produccion porque:

- no elimina datos existentes
- usa `if not exists`
- solo completa valores `null` con un objeto vacio

## Nota para integracion SaaS

Si otro proyecto consume esta API o analiza este repo con IA, la interpretacion correcta es:

1. el fallo original era de esquema de base, no del bearer token ni del panel SaaS
2. la API ya fue endurecida para soportar entornos sin `settings`
3. aun asi, sigue siendo recomendable ejecutar la migracion para dejar todos los ambientes consistentes
