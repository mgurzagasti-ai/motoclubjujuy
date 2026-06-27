# Project Memory

## Proyecto

- Nombre: `motoclubjujuy`
- Stack: `Next.js 16`, `React 19`, `TypeScript`, `Supabase`, `Cloudinary`
- Objetivo principal: sitio web de `Moto Club Jujuy` con panel admin y API para integracion con un panel SaaS externo.

## Estructura importante

- App principal: `app/`
- Componentes: `components/`
- Librerias compartidas: `lib/`
- Scripts SQL: `scripts/`
- Assets publicos: `public/assets/`

## Persistencia actual

- Contenido principal del sitio en tabla `public.site_content`
- Campos usados hoy:
  - `slug`
  - `nav_items`
  - `quienes`
  - `fotos`
  - `events`
  - `novedades`
  - `settings`
  - `updated_at`
- Uploads de imagenes via `Cloudinary`

## API SaaS implementada

- Base local esperada: `http://localhost:3005/api`
- Base productiva esperada: `https://motoclubjujuy.vercel.app/api`
- Autenticacion: header `Authorization: Bearer <token>`
- Variable principal del token: `SAAS_PANEL_API_TOKEN`

### Endpoints

- `GET /api/site-content`
- `PUT /api/site-content`
- `GET /api/events`
- `GET /api/events/:id`
- `POST /api/events`
- `PUT /api/events/:id`
- `DELETE /api/events/:id`
- `GET /api/gallery`
- `GET /api/gallery/:id`
- `POST /api/gallery`
- `PUT /api/gallery/:id`
- `DELETE /api/gallery/:id`
- `POST /api/uploads`
- `GET /api/news`
- `GET /api/news/:id`
- `POST /api/news`
- `PUT /api/news/:id`
- `DELETE /api/news/:id`

## Compatibilidades importantes

- `app/api/site-content/route.ts` mantiene compatibilidad con el admin actual por `username/password`
- La API nueva para el SaaS usa bearer token
- `events`, `gallery` y `news` se exponen desde los JSON guardados en `site_content`

## Variables de entorno

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER`
- `KEEPALIVE_TOKEN`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SAAS_PANEL_API_TOKEN`

## Archivos clave

- `MOTOC LUB_API_SPEC.md`
- `scripts/supabase-site-content.sql`
- `app/api/site-content/route.ts`
- `app/api/events/route.ts`
- `app/api/gallery/route.ts`
- `app/api/news/route.ts`
- `app/api/uploads/route.ts`
- `lib/api-auth.ts`
- `lib/motoclub-api.ts`
- `lib/site-content-store.ts`

## Ultimas decisiones tecnicas

- Se agrego `settings` a `site_content` para persistir `heroTitle`, `heroSubtitle`, `heroImage`, `contactText` y `featuredEventId`
- No se crearon tablas separadas para `events`, `gallery` o `news`; se reutiliza `site_content` para avanzar mas rapido
- La capa de API del SaaS traduce entre el formato simple del panel y el formato interno del sitio

## Pendientes recomendados

- Ejecutar en Supabase el script `scripts/supabase-site-content.sql` actualizado
- Configurar `SAAS_PANEL_API_TOKEN` en el entorno de deploy
- Documentar ejemplos exactos de request/response para el panel SaaS
- Evaluar si a futuro conviene migrar `events`, `gallery` y `news` a tablas propias

## Verificaciones realizadas

- `eslint`: OK
- `next build`: OK
