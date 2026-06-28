# Fix Prompt Para Proyecto `motoclubjujuy`

Usa este texto como prompt o instruccion de trabajo dentro del proyecto `motoclubjujuy`.

---

Estoy integrando este proyecto con un panel SaaS externo que consume la API documentada en `API_INTEGRATION_GUIDE.md`.

## Problema actual

Cuando el panel intenta abrir `GET /api/site-content` o cargar la sincronizacion de contenido, la API en produccion falla con este error:

```txt
column site_content.settings does not exist
```

El error llega desde la capa de API remota y no desde el panel.

## Lo que necesito que revises y arregles

1. Revisa los endpoints:
   - `app/api/site-content/route.ts`
   - `app/api/events/route.ts`
   - `app/api/events/[id]/route.ts`
   - `app/api/gallery/route.ts`
   - `app/api/gallery/[id]/route.ts`
   - `app/api/news/route.ts`
   - `app/api/news/[id]/route.ts`

2. Revisa especialmente estas utilidades:
   - `lib/motoclub-api.ts`
   - `lib/site-content-store.ts`
   - cualquier acceso SQL/Supabase/ORM a `site_content`

3. Busca referencias a:
   - `site_content.settings`
   - `site_content.events`
   - `site_content.fotos`
   - `site_content.novedades`
   - `site_content.quienes`

## Hipotesis mas probable

El codigo nuevo de la API esta asumiendo que existe una columna `settings` en la tabla `site_content`, pero la base real en produccion no tiene esa columna.

Puede estar pasando una de estas dos cosas:

1. La tabla `site_content` usa columnas separadas y no JSON `settings`.
2. La tabla `site_content` deberia tener una columna JSON `settings`, pero nunca se creo en produccion.

## Objetivo del arreglo

Quiero que la API vuelva a responder correctamente sin romper compatibilidad con los datos reales ya cargados.

## Lo que espero que hagas

1. Inspecciona el esquema real de la tabla `site_content`.
2. Detecta si el codigo esta leyendo columnas inexistentes.
3. Corrige la capa de almacenamiento para que:
   - lea el esquema real actual, o
   - haga fallback seguro si falta `settings`, o
   - migre el esquema si esa era la intencion original.

## Requisito importante

No quiero un arreglo superficial solo para silenciar el error. Quiero que los endpoints sigan funcionando para estos recursos:

- `GET /api/site-content`
- `PUT /api/site-content`
- `GET /api/events`
- `POST /api/events`
- `PUT /api/events/:id`
- `GET /api/gallery`
- `POST /api/gallery`
- `GET /api/news`
- `POST /api/news`

## Si falta migracion

Si descubres que el problema real es una migracion faltante o una columna que falta crear, entonces:

1. genera el SQL exacto necesario
2. explica si es seguro para produccion
3. adapta el codigo para tolerar datos previos incompletos si hace falta

## Entrega esperada

Quiero que me devuelvas:

1. la causa exacta del error
2. los archivos corregidos
3. la migracion o SQL necesario si aplica
4. una explicacion breve de por que fallaba

## Contexto extra

El panel SaaS externo ya esta listo para consumir esta API con bearer token y actualmente:

- `MOTOCLUB_API_BASE_URL=https://motoclubjujuy.vercel.app/api`
- usa `SAAS_PANEL_API_TOKEN`
- ya conecta bien, pero falla por este error interno de base

La prioridad es restaurar la API remota para que el panel pueda:

- leer `site-content`
- listar `events`
- listar `news`
- crear y editar contenido sin errores

