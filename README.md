# CIAC Registro MVP

MVP mínimo y limpio de **CIAC Registro** preparado para **GitHub + Vercel**, con frontend estático y funciones serverless en `/api`.

## 1. Estructura del proyecto

```text
/api
  buscar.js
  registrar.js
  registros-hoy.js

/public
  index.html
  styles.css
  app.js

/lib
  alumnos-data.js
  rut.js
  registros-store.js

package.json
vercel.json
README.md
```

## 2. Qué hace este MVP

Este MVP hace solo lo necesario:

1. permite ingresar RUN completo sin cortarlo
2. autocompleta DV, carrera y año de ingreso desde una fuente textual dentro del repo
3. registra entrada y salida
4. muestra los registros del día sin recargar la página

## 3. Decisiones técnicas

- **Frontend:** HTML + CSS + JavaScript nativo
- **Backend:** funciones serverless dentro de `/api`
- **Fuente de alumnos:** `lib/alumnos-data.js`
- **Validación de RUT:** `lib/rut.js`
- **Persistencia temporal del MVP:** `lib/registros-store.js`

No se usa servidor persistente tipo Express.
No se usa base binaria en runtime.
No hay arquitectura de escritorio ni mezcla de proyectos anteriores.

## 4. Fuente de datos del alumno

La fuente usada en el repo contiene estos campos reales:

- `rut`
- `dv`
- `cohorte`
- `carrera_ingreso`
- `sede`

Mapeo aplicado en la app:

- `rut` -> `run`
- `dv` -> `dv`
- `carrera_ingreso` -> `carrera`
- `cohorte` -> `anio_ingreso`

### Importante sobre el nombre

**El nombre no viene en la fuente real.**
Por eso:

- **no se autocompleta**
- **no se inventa**
- **queda como ingreso manual y editable**

## 5. Cómo ejecutar localmente

### Requisitos
- Node.js 18 o superior
- npm

### Pasos
```bash
npm install
npm run dev
```

Luego abre la URL local que entregue Vercel Dev.

## 6. Cómo subirlo a GitHub

```bash
git init
git add .
git commit -m "feat: CIAC Registro MVP"
git branch -M main
git remote add origin TU_URL_DEL_REPOSITORIO
git push -u origin main
```

## 7. Cómo desplegarlo en Vercel

### Opción web
1. crea un repositorio en GitHub
2. sube este proyecto
3. entra a Vercel
4. importa el repositorio
5. despliega sin cambios adicionales

### Opción CLI
```bash
npm i -g vercel
vercel
```

## 8. Endpoints incluidos

### `GET /api/buscar?run=123`
- busca por RUN con mínimo 3 dígitos
- devuelve coincidencia si existe

### `POST /api/registrar`
Recibe:
```json
{
  "run": "12345678",
  "dv": "9",
  "nombre": "Nombre Manual",
  "carrera": "Ingeniería Civil",
  "anio_ingreso": "2024"
}
```

Valida RUT y decide:
- entrada si no hay registro abierto hoy
- salida si ya hay registro abierto hoy

### `GET /api/registros-hoy`
- devuelve el arreglo de registros del día

## 9. Limitaciones actuales del MVP

Este MVP **no usa persistencia real**.
El almacenamiento de registros está encapsulado en `lib/registros-store.js` y actualmente funciona como memoria temporal del proceso serverless.

Eso significa:

- en desarrollo local funciona bien para probar el flujo
- en producción puede reiniciarse entre invocaciones
- está preparado para reemplazarse después por una persistencia real sin reescribir toda la app

## 10. Criterios que sí cumple

- RUN sin corte incorrecto
- sin salto automático al DV
- autocompletado de DV, carrera y año de ingreso
- nombre manual
- alternancia entrada/salida
- tabla actualizada sin recargar
- estructura compatible con GitHub + Vercel
- sin dependencias infladas
- sin pseudocódigo
- sin archivos muertos
