# API Integration Guide

## Objetivo

Este archivo documenta la API real del proyecto `motoclubjujuy` para poder integrarla desde otro sistema, por ejemplo un panel SaaS externo.

## Base URL

- Local: `http://localhost:3005/api`
- Produccion esperada: `https://motoclubjujuy.vercel.app/api`

## Autenticacion

Todos los endpoints de integracion SaaS usan bearer token:

```http
Authorization: Bearer TU_TOKEN
```

Variable de entorno usada por este proyecto:

```txt
SAAS_PANEL_API_TOKEN
```

## Formato general de respuestas

### Exito

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": "Mensaje de error"
}
```

Algunos errores tambien pueden incluir:

```json
{
  "success": false,
  "error": "Mensaje de error",
  "detail": "Detalle tecnico"
}
```

## Recursos disponibles

- `site-content`
- `events`
- `gallery`
- `uploads`
- `news`

---

## 1. Site Content

Sirve para editar el contenido principal simplificado del sitio.

### GET `/api/site-content`

#### Respuesta

```json
{
  "success": true,
  "data": {
    "heroTitle": "Moto Club Jujuy",
    "heroSubtitle": "Comunidad, ruta y encuentros",
    "heroImage": "/assets/evento-motoencuentro.jpeg",
    "aboutText": "<p>...</p>",
    "contactText": "Escribinos para sumarte al club o conocer proximos eventos.",
    "featuredEventId": "event-main",
    "updatedAt": "2026-06-27T20:00:00.000Z"
  }
}
```

### PUT `/api/site-content`

#### Body esperado

```json
{
  "heroTitle": "Moto Club Jujuy",
  "heroSubtitle": "Comunidad, ruta y encuentros",
  "heroImage": "/uploads/hero.jpg",
  "aboutText": "<p>Nuevo texto</p>",
  "contactText": "Escribinos por WhatsApp",
  "featuredEventId": "evt_001"
}
```

#### Notas

- `aboutText` se guarda sobre el campo interno `quienes`
- `featuredEventId` apunta a uno de los eventos existentes
- si el `featuredEventId` no existe, el sistema puede crear una base minima para no romper la referencia

---

## 2. Events

Sirve para listar y administrar eventos.

### Estructura

```json
{
  "id": "evt_001",
  "title": "Rodada del fin de semana",
  "description": "Salida grupal con punto de encuentro en plaza central.",
  "date": "2026-07-10T15:00:00.000Z",
  "location": "San Salvador de Jujuy",
  "coverImage": "/uploads/rodada-julio.jpg",
  "published": true,
  "createdAt": "2026-06-27T20:00:00.000Z",
  "updatedAt": "2026-06-27T20:00:00.000Z"
}
```

### Endpoints

- `GET /api/events`
- `GET /api/events/:id`
- `POST /api/events`
- `PUT /api/events/:id`
- `DELETE /api/events/:id`

### POST `/api/events`

#### Body esperado

```json
{
  "title": "Rodada del fin de semana",
  "description": "Salida grupal con punto de encuentro en plaza central.",
  "date": "2026-07-10T15:00:00.000Z",
  "location": "San Salvador de Jujuy",
  "coverImage": "/uploads/rodada-julio.jpg",
  "published": true
}
```

### PUT `/api/events/:id`

#### Body esperado

Misma estructura que `POST`, parcial o completa.

### DELETE `/api/events/:id`

#### Respuesta ejemplo

```json
{
  "success": true,
  "data": {
    "id": "evt_001"
  }
}
```

---

## 3. Gallery

Sirve para listar y administrar imagenes de galeria.

### Estructura

```json
{
  "id": "gal_001",
  "title": "Encuentro en ruta",
  "imageUrl": "/uploads/encuentro-ruta.jpg",
  "caption": "Salida grupal de junio",
  "category": "rodadas",
  "published": true,
  "createdAt": "2026-06-27T20:00:00.000Z",
  "updatedAt": "2026-06-27T20:00:00.000Z"
}
```

### Endpoints

- `GET /api/gallery`
- `GET /api/gallery/:id`
- `POST /api/gallery`
- `PUT /api/gallery/:id`
- `DELETE /api/gallery/:id`

### POST `/api/gallery`

#### Body esperado

```json
{
  "title": "Encuentro en ruta",
  "imageUrl": "/uploads/encuentro-ruta.jpg",
  "caption": "Salida grupal de junio",
  "category": "rodadas",
  "published": true
}
```

### Nota

- `imageUrl` puede ser una URL publica o una URL devuelta previamente por `/api/uploads`

---

## 4. Uploads

Sirve para subir una imagen al proveedor configurado y obtener una URL reutilizable.

### POST `/api/uploads`

#### Tipo de request

- `multipart/form-data`

#### Campos soportados

- `file`: archivo binario
- `sourceUrl`: alternativa a `file`, para subir desde URL publica
- `title`: opcional
- `description`: opcional

#### Respuesta esperada

```json
{
  "success": true,
  "url": "https://res.cloudinary.com/.../image/upload/archivo.jpg",
  "filename": "archivo"
}
```

### Notas

- si existe `file`, se prioriza ese valor
- si no existe `file`, puede usarse `sourceUrl`
- este endpoint requiere configuracion valida de `Cloudinary`

---

## 5. News

Sirve para listar y administrar novedades.

### Estructura

```json
{
  "id": "news_001",
  "title": "Nuevo encuentro confirmado",
  "slug": "nuevo-encuentro-confirmado",
  "summary": "Ya tenemos fecha para la proxima salida.",
  "content": "Texto completo de la novedad.",
  "coverImage": "/uploads/novedad.jpg",
  "published": true,
  "createdAt": "2026-06-27T20:00:00.000Z",
  "updatedAt": "2026-06-27T20:00:00.000Z"
}
```

### Endpoints

- `GET /api/news`
- `GET /api/news/:id`
- `POST /api/news`
- `PUT /api/news/:id`
- `DELETE /api/news/:id`

### POST `/api/news`

#### Body esperado

```json
{
  "title": "Nuevo encuentro confirmado",
  "slug": "nuevo-encuentro-confirmado",
  "summary": "Ya tenemos fecha para la proxima salida.",
  "content": "Texto completo de la novedad.",
  "coverImage": "/uploads/novedad.jpg",
  "published": true
}
```

---

## Comportamiento interno importante

Este proyecto hoy no usa tablas separadas para `events`, `gallery` y `news`.

En cambio:

- `events` se guarda dentro del JSON `site_content.events`
- `gallery` se guarda dentro del JSON `site_content.fotos`
- `news` se guarda dentro del JSON `site_content.novedades`
- `site-content` usa `site_content.settings` y `site_content.quienes`

El otro sistema no necesita saber esta implementacion interna para consumir la API, pero es importante dejarlo documentado.

## Variables de entorno necesarias

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=
SAAS_PANEL_API_TOKEN=
```

## Ejemplo de consumo desde otro proyecto

### Leer eventos

```ts
const response = await fetch("https://motoclubjujuy.vercel.app/api/events", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const payload = await response.json();
```

### Crear evento

```ts
const response = await fetch("https://motoclubjujuy.vercel.app/api/events", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    title: "Rodada nocturna",
    description: "Salida grupal",
    date: "2026-07-10T20:00:00.000Z",
    location: "San Salvador de Jujuy",
    coverImage: "https://...",
    published: true,
  }),
});

const payload = await response.json();
```

## Archivos fuente de esta API

- `app/api/site-content/route.ts`
- `app/api/events/route.ts`
- `app/api/events/[id]/route.ts`
- `app/api/gallery/route.ts`
- `app/api/gallery/[id]/route.ts`
- `app/api/news/route.ts`
- `app/api/news/[id]/route.ts`
- `app/api/uploads/route.ts`
- `lib/api-auth.ts`
- `lib/motoclub-api.ts`
- `lib/site-content-store.ts`
