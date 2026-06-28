# API requerida para integrar `Moto Club Jujuy` con `SaaS Panel Control`

## Objetivo

Este documento define la API que necesita el proyecto web de `Moto Club Jujuy` para que el panel `SaaS Panel Control` pueda editar contenido de la web desde un panel central.

La idea es que:

- la web pública siga mostrando el contenido del club
- el panel admin pueda crear, editar y eliminar contenido
- la comunicación entre ambos proyectos se haga por API

---

## Base URL esperada

La API debería quedar disponible bajo una base similar a:

```txt
https://motoclubjujuy.vercel.app/api
```

En desarrollo local podría ser:

```txt
http://localhost:3000/api
```

---

## Autenticación

La API no debe quedar abierta.

Se recomienda protegerla con un token simple en header:

```txt
Authorization: Bearer TU_TOKEN_SECRETO
```

El panel enviará ese token en cada request.

---

## Recursos mínimos recomendados

Para una primera versión útil, la API debería manejar:

- `events`
- `gallery`
- `site-content`
- `uploads`

Opcional después:

- `news`

---

## 1. Events

Sirve para crear y mostrar encuentros, rodadas, reuniones y eventos del club.

### Estructura sugerida

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

```txt
GET    /api/events
GET    /api/events/:id
POST   /api/events
PUT    /api/events/:id
DELETE /api/events/:id
```

### `POST /api/events`

Body esperado:

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

---

## 2. Gallery

Sirve para subir y administrar imágenes de la web.

### Estructura sugerida

```json
{
  "id": "gal_001",
  "title": "Encuentro en ruta",
  "imageUrl": "/uploads/encuentro-ruta.jpg",
  "caption": "Salida grupal de junio",
  "category": "rodadas",
  "published": true,
  "createdAt": "2026-06-27T20:00:00.000Z"
}
```

### Endpoints

```txt
GET    /api/gallery
GET    /api/gallery/:id
POST   /api/gallery
PUT    /api/gallery/:id
DELETE /api/gallery/:id
```

### `POST /api/gallery`

Body esperado:

```json
{
  "title": "Encuentro en ruta",
  "imageUrl": "/uploads/encuentro-ruta.jpg",
  "caption": "Salida grupal de junio",
  "category": "rodadas",
  "published": true
}
```

---

## 3. Site Content

Sirve para editar textos principales del home o secciones fijas del sitio.

### Estructura sugerida

```json
{
  "heroTitle": "Moto Club Jujuy",
  "heroSubtitle": "Comunidad, ruta y encuentros",
  "heroImage": "/uploads/hero-moto-club.jpg",
  "aboutText": "Somos una comunidad motera enfocada en la camaraderia y la ruta.",
  "contactText": "Escribinos para sumarte al club o conocer proximos eventos.",
  "featuredEventId": "evt_001",
  "updatedAt": "2026-06-27T20:00:00.000Z"
}
```

### Endpoints

```txt
GET /api/site-content
PUT /api/site-content
```

### `PUT /api/site-content`

Body esperado:

```json
{
  "heroTitle": "Moto Club Jujuy",
  "heroSubtitle": "Comunidad, ruta y encuentros",
  "heroImage": "/uploads/hero-moto-club.jpg",
  "aboutText": "Somos una comunidad motera enfocada en la camaraderia y la ruta.",
  "contactText": "Escribinos para sumarte al club o conocer proximos eventos.",
  "featuredEventId": "evt_001"
}
```

---

## 4. Uploads

Sirve para subir imágenes y devolver una URL usable por la web.

### Endpoint

```txt
POST /api/uploads
```

### Entrada esperada

- `multipart/form-data`
- campo `file`

### Respuesta sugerida

```json
{
  "success": true,
  "url": "/uploads/mi-imagen.jpg",
  "filename": "mi-imagen.jpg"
}
```

---

## 5. News (opcional)

Si querés editar noticias o novedades además de eventos.

### Estructura sugerida

```json
{
  "id": "news_001",
  "title": "Nuevo encuentro confirmado",
  "slug": "nuevo-encuentro-confirmado",
  "summary": "Ya tenemos fecha para la proxima salida.",
  "content": "Texto completo de la novedad.",
  "coverImage": "/uploads/novedad.jpg",
  "published": true,
  "createdAt": "2026-06-27T20:00:00.000Z"
}
```

### Endpoints

```txt
GET    /api/news
GET    /api/news/:id
POST   /api/news
PUT    /api/news/:id
DELETE /api/news/:id
```

---

## Respuestas recomendadas

### Éxito

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

---

## Recomendaciones técnicas

- Si el proyecto de `Moto Club Jujuy` está hecho en `Next.js`, la API puede implementarse con `app/api/.../route.ts`.
- Conviene guardar datos en una base como `PostgreSQL`, `Supabase` o `SQLite` al principio.
- Para imágenes, conviene usar:
  - `Vercel Blob`
  - `Cloudinary`
  - `Supabase Storage`

---

## Qué necesita después el panel SaaS para conectarse

Cuando esta API exista, el panel necesitará:

- `base URL` exacta
- token de autenticación
- estructura final de cada endpoint
- formato real de respuestas

Con eso se podrá programar en `SaaS Panel Control`:

- alta de eventos
- edición de contenido del home
- subida de fotos
- galería administrable

---

## Prioridad sugerida

Implementar primero:

1. `uploads`
2. `site-content`
3. `events`
4. `gallery`

---

## Nota final

Una vez creada esta API en el proyecto de `Moto Club Jujuy`, el siguiente paso será conectar este panel SaaS para consumirla y administrar el contenido desde una sola interfaz.
