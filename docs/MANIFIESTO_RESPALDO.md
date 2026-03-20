# MANIFIESTO DE RESPALDO

Documento de respaldo técnico previo a cualquier corrección profunda o reinicio del proyecto.

## 1. Variables de entorno detectadas

| Variable | Detectada en código | Uso confirmado | Estado |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | Base URL REST de Supabase. | Crítica |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Se verifica presencia, pero no se usa como credencial backend efectiva. | Parcial |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Credencial efectiva para `apikey` y `Authorization` en backend. | Crítica |

### Nota
No se detectaron otras variables de entorno en el código auditado. Si existen variables configuradas fuera del repositorio, quedan como **no confirmadas**.

## 2. Endpoints existentes

### Backend serverless
- `GET /api/buscar`
- `POST /api/registrar`
- `POST /api/registrar-salida`
- `GET /api/registros-hoy`
- `GET /api/report-data`
- `GET /api/exportar-registros`
- `GET /api/export-report`

### Endpoints con observación de riesgo
- `GET /api/registros-hoy` → ‼️ RIESGO: no está filtrando por día en la versión auditada.
- `GET /api/report-data` → ‼️ RIESGO: filtros desactivados temporalmente.

## 3. Tablas de Supabase detectadas por nombre

### Confirmadas en código
- `attendance_records`
- `students_matrix`

### Estructura detectada de `attendance_records`
Se detectan **dos versiones distintas** del esquema:

#### Versión A: `supabase-schema.sql`
- `id`
- `dia`
- `hora_entrada` (`time without time zone`)
- `hora_salida` (`time without time zone`)
- `run`
- `dv`
- `carrera`
- `sede`
- `anio_ingreso`
- `actividad`
- `tematica`
- `observaciones`
- `espacio`
- `estado`
- `created_at`

#### Versión B: `sql/attendance_records.sql`
- `id`
- `dia`
- `hora_entrada` (`timestamptz`)
- `hora_salida` (`timestamptz`)
- `run`
- `dv`
- `carrera`
- `sede`
- `anio_ingreso`
- `actividad`
- `tematica`
- `observaciones`
- `espacio`
- `estado`
- `created_at`

‼️ RIESGO: antes de refactorizar o reiniciar, confirmar cuál esquema refleja la base real de Supabase.

## 4. Helpers críticos

### Backend
- `lib/supabase.js`
  - `getSupabaseConfig`
  - `supabaseRequest`
  - `supabaseGet`
  - `supabasePost`
  - `supabasePatch`

- `lib/rut.js`
  - `cleanRun`
  - `cleanDv`
  - `calculateDv`
  - `isValidRut`

## 5. Archivos frontend críticos

### Pantalla principal
- `public/index.html`
- `public/app.js`
- `public/styles.css`

### Dashboard / reportes
- `public/report.html`
- `public/report.js`
- `public/styles.css`

## 6. Dependencias instaladas

### Declaradas en `package.json`
- `node-fetch@^2.7.0`
- `xlsx@^0.18.5`

### Observaciones
- `xlsx` es crítica para exportación Excel.
- `node-fetch` parece no estar usado directamente en el código auditado. Posible residuo. **No confirmado** si se conserva por compatibilidad de runtime.

## 7. Flujo mínimo respaldable del MVP

### Entrada
- búsqueda de alumno por RUN vía `students_matrix`
- autocompletado de DV, carrera, año y eventualmente sede
- registro de entrada en `attendance_records`

### Salida
- cierre de registro mediante `id`
- actualización de `hora_salida` y `estado`

### Consulta y control diario
- listado principal desde `/api/registros-hoy`
- dashboard desde `/api/report-data`

### Exportación
- CSV desde `/api/exportar-registros`
- Excel desde `/api/export-report`

## 8. Duplicidades y archivos sospechosos que deben respaldarse antes de limpiar

### Duplicidades confirmadas
- `supabase-schema.sql` ↔ `sql/attendance_records.sql`
- lógica de fechas Chile repetida en varios endpoints
- catálogos de campus/espacios repartidos entre frontend y backend

### Archivos sospechosos
- `README.md` → documentación de una versión anterior del proyecto.
- `package.json` → dependencia `node-fetch` posiblemente residual.

## 9. Checklist de respaldo antes de tocar nada

### Base de datos / Supabase
- [ ] Exportar estructura real de `attendance_records` desde Supabase.
- [ ] Exportar políticas, índices y restricciones de `attendance_records`.
- [ ] Confirmar esquema real de `students_matrix`.
- [ ] Exportar una muestra de datos reales de ambas tablas.
- [ ] Confirmar tipos reales de `dia`, `hora_entrada`, `hora_salida` y `created_at`.

### Configuración
- [ ] Respaldar `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] Respaldar `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Respaldar `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Confirmar variables adicionales fuera del repo. Si existen, documentarlas.

### Código
- [ ] Respaldar carpeta `api/` completa.
- [ ] Respaldar carpeta `lib/` completa.
- [ ] Respaldar carpeta `public/` completa.
- [ ] Respaldar `package.json`.
- [ ] Respaldar `vercel.json`.
- [ ] Respaldar `supabase-schema.sql`.
- [ ] Respaldar `sql/attendance_records.sql`.
- [ ] Respaldar `README.md` por valor histórico, aunque esté desactualizado.

### Validación funcional
- [ ] Probar búsqueda por RUN.
- [ ] Probar registro de entrada.
- [ ] Probar registro de salida.
- [ ] Probar carga del listado principal.
- [ ] Probar dashboard de reportes.
- [ ] Probar exportación CSV.
- [ ] Probar exportación Excel.

## 10. Decisión de conservación si se reinicia

Si se decide reiniciar desde cero, conservar obligatoriamente:
- el contrato funcional visible en `public/index.html` y `public/report.html`,
- la lógica de interacción de `public/app.js` y `public/report.js` como referencia de producto,
- `lib/supabase.js` como referencia de integración,
- `lib/rut.js` como helper reusable,
- ambos scripts SQL hasta confirmar cuál representa la realidad,
- la lista completa de endpoints y variables de entorno de este manifiesto.
