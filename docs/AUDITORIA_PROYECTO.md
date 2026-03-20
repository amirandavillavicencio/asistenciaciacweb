# 1. Resumen ejecutivo

## Estado general
El proyecto actual es un MVP web muy pequeño, compuesto por frontend estático en `public/` y funciones serverless en `api/`. La base es entendible y todavía acotada, pero presenta señales claras de evolución improvisada: el `README.md` describe una arquitectura anterior que ya no coincide con el código real, existen endpoints de diagnóstico temporal que quedaron expuestos como parte del flujo productivo y hay duplicidad de definiciones críticas como el esquema SQL de `attendance_records`.

En términos prácticos, **no parece un proyecto perdido ni inmantenible por tamaño**, pero **sí tiene suficiente deuda técnica y suficiente inconsistencia operativa** como para que seguir agregando cambios sin ordenar la base aumente el riesgo de romper el MVP.

## Lectura ejecutiva de la decisión
- ✅ **Hay una base reutilizable**: el flujo principal de registro, salida, exportación y dashboard existe y está separado en frontend + API + helper de Supabase.
- ‼️ **Hay riesgos importantes**: filtros desactivados en endpoints críticos, uso obligatorio de `SUPABASE_SERVICE_ROLE_KEY` en backend, documentación obsoleta, y dos definiciones distintas del esquema de la tabla principal.
- ✅ **El tamaño del proyecto sigue siendo pequeño**: todavía se puede corregir sin un costo desproporcionado.
- ‼️ **No conviene seguir "parchando" encima** de la base actual sin una refactorización dirigida.

## Conclusión ejecutiva
**Veredicto recomendado: REFACTORIZAR PARCIALMENTE.**

No recomiendo reiniciar desde cero porque el dominio funcional ya está plasmado, la UI ya cubre los casos principales y la integración con Supabase está centralizada. Pero tampoco recomiendo simplemente "mantener y estabilizar" sin intervención estructural, porque ya hay señales de deriva técnica: endpoints de reporte y listado funcionando con consultas reducidas “temporales”, duplicidad de contratos y desacople insuficiente entre frontend, API, datos y diagnóstico.

# 2. Inventario técnico

## 2.1 Estructura detectada

### Raíz
- `api/`: funciones serverless del backend.
- `lib/`: utilidades compartidas del backend.
- `public/`: frontend estático principal y dashboard de reportes.
- `sql/`: script SQL alternativo para `attendance_records`.
- `docs/`: documentación generada en esta auditoría.
- `supabase-schema.sql`: segundo script SQL para la tabla principal.
- `vercel.json`: configuración mínima de despliegue.
- `package.json`: manifiesto de dependencias.
- `README.md`: documentación desactualizada respecto al código real.

## 2.2 Archivos clave y propósito

### Backend / API
- `api/buscar.js`: busca estudiante en Supabase por RUN sobre `students_matrix`.
- `api/registrar.js`: registra entrada en `attendance_records` con validaciones de campus, actividad, temática y espacio.
- `api/registrar-salida.js`: cierra un registro abierto del día mediante `hora_salida` y `estado`.
- `api/registros-hoy.js`: entrega registros recientes y además devuelve un bloque de depuración del entorno.
- `api/report-data.js`: entrega datos para dashboard, pero actualmente con filtros desactivados temporalmente.
- `api/exportar-registros.js`: exporta CSV de registros del día.
- `api/export-report.js`: exporta Excel de informe diario filtrable.

### Librerías / helpers
- `lib/supabase.js`: cliente REST manual para Supabase usando `fetch`, armado de URL, headers y manejo de errores.
- `lib/rut.js`: limpieza y validación de RUN/DV chileno.

### Frontend
- `public/index.html`: interfaz principal de registro y tabla operacional del día.
- `public/app.js`: lógica del frontend principal; búsqueda, registro, salida, exportación CSV y apertura de dashboard.
- `public/report.html`: dashboard diario de reportes.
- `public/report.js`: lógica del dashboard; filtros, KPIs, gráfico horario, exportación Excel.
- `public/styles.css`: estilos compartidos de la aplicación y del dashboard.

### SQL
- `supabase-schema.sql`: esquema de `attendance_records` con `hora_entrada` y `hora_salida` como `time without time zone` y varios campos `not null`.
- `sql/attendance_records.sql`: esquema alternativo de `attendance_records` con `hora_entrada` y `hora_salida` como `timestamptz` y múltiples columnas opcionales.

## 2.3 Endpoints API detectados

| Endpoint | Método | Propósito | Estado observado |
|---|---|---|---|
| `/api/buscar` | GET | Busca estudiante por RUN en `students_matrix`. | ✅ ESTABLE a nivel estructural; devuelve `alumno: null` si falla. |
| `/api/registrar` | POST | Registra entrada en `attendance_records`. | ✅ ESTABLE en estructura, con validaciones explícitas. |
| `/api/registrar-salida` | POST | Registra salida por `id`. | ✅ ESTABLE en estructura. |
| `/api/registros-hoy` | GET | Devuelve listado para pantalla principal. | ‼️ RIESGO: consulta “temporalmente reducida” sin filtro por día. |
| `/api/report-data` | GET | Datos del dashboard. | ‼️ RIESGO: filtros desactivados temporalmente, contradice contrato esperado. |
| `/api/exportar-registros` | GET | Exporta CSV del día. | ✅ ESTABLE funcionalmente, aunque depende del contrato real de fechas en Supabase. |
| `/api/export-report` | GET | Exporta Excel del informe diario con filtros. | ✅ ESTABLE funcionalmente, mejor alineado que `report-data`. |

## 2.4 Dependencias instaladas detectadas

### Declaradas en `package.json`
- `node-fetch@^2.7.0`
- `xlsx@^0.18.5`

### Observaciones
- ‼️ `node-fetch` **no aparece usado directamente** en el código auditado. En `lib/supabase.js` se usa `fetch` global (`const fetchFn = (...args) => fetch(...args);`), por lo que la dependencia parece redundante salvo que se esté confiando en el runtime de Node 18+.
- `xlsx` sí es crítica para `api/export-report.js`.

## 2.5 Configuración detectada

- `vercel.json`
  - `version: 2`
  - `cleanUrls: true`

Configuración muy mínima. No se detectan reglas de rutas, headers, protección de endpoints ni configuración de runtime.

## 2.6 Variables de entorno detectadas

Detectadas en `lib/supabase.js` y referenciadas también en endpoints de diagnóstico:

| Variable | Uso confirmado | Propósito observado | Comentario |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | Base URL del proyecto Supabase para REST. | Crítica. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Parcial | Se diagnostica su presencia, pero no se usa para autenticación backend. | Existe como chequeo, no como credencial efectiva del backend. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Credencial usada por el backend para `apikey` y `Authorization`. | ‼️ RIESGO alto si se rota o falta. |

### Variables no confirmadas
No se detectaron otras variables de entorno en el código auditado.

## 2.7 Clientes o helpers de Supabase

### `lib/supabase.js`
Centraliza:
- lectura de variables de entorno,
- construcción de requests a `/rest/v1/{path}`,
- serialización de query params,
- headers `apikey`, `Authorization`, `Content-Type`,
- manejo de errores con `status` y `details`.

### Observaciones clave
- ✅ Positivo: existe un único helper real de acceso a Supabase.
- ‼️ RIESGO: el backend depende exclusivamente de `SUPABASE_SERVICE_ROLE_KEY`, aunque el error dice que también se requiere `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; el `anon key` se valida parcialmente pero no participa en la autenticación efectiva.
- ‼️ RIESGO: el helper opera a nivel REST manual en vez de SDK tipado, lo que vuelve más frágil el contrato con filtros, columnas y tipos.

## 2.8 Tablas de Supabase detectadas por nombre

### Confirmadas por código
- `attendance_records`
- `students_matrix`

### Tablas no confirmadas
No se detectan otras tablas reales en el código auditado.

## 2.9 Componentes funcionales principales del frontend

### Pantalla principal (`public/index.html` + `public/app.js`)
- selector superior de campus,
- formulario de RUN/DV,
- autocompletado académico,
- selección de actividad,
- selección de temática,
- selección dependiente de espacio por campus,
- observaciones,
- tabla de registros del día,
- acción de salida por fila,
- exportación CSV,
- acceso a dashboard de reportes.

### Dashboard (`public/report.html` + `public/report.js`)
- filtros por campus, motivo y actividad,
- KPIs de totales, activos, cerrados y permanencia,
- gráfico horario en canvas,
- barras por actividad y sede,
- highlights automáticos,
- tabla consolidada,
- exportación Excel.

# 3. Flujos funcionales

## 3.1 Búsqueda / autocompletado
1. El usuario escribe RUN en `public/index.html`.
2. `public/app.js` sanitiza a solo dígitos y espera 300 ms.
3. Si hay menos de 3 dígitos, limpia DV, carrera y año.
4. Si hay 3 o más, hace `GET /api/buscar?run=...`.
5. `api/buscar.js` consulta `students_matrix` por `rut = eq.{run}` con `limit=1`.
6. Si encuentra coincidencia, devuelve `run`, `dv`, `carrera`, `anio_ingreso`, `sede`.
7. El frontend completa DV, carrera y año; si el alumno trae sede y el usuario aún no eligió campus, sincroniza el campus superior.

### Estado del flujo
- ✅ ESTABLE: el flujo existe, es entendible y está encapsulado.
- ‼️ RIESGO: si falla Supabase, el endpoint responde `200` con `alumno: null`, lo que evita romper UI pero oculta fallos reales de backend.
- ‼️ RIESGO: el autocompletado depende de coincidencia exacta de `students_matrix.rut` con el RUN limpio; no hay fallback ni búsqueda parcial real.

## 3.2 Registro de entrada
1. El usuario selecciona campus en cabecera.
2. Elige actividad, temática, espacio y observaciones.
3. Envía el formulario.
4. `public/app.js` construye payload y llama `POST /api/registrar`.
5. `api/registrar.js` valida:
   - campus,
   - RUN numérico,
   - DV de 1 carácter,
   - carrera,
   - año de ingreso de 4 dígitos,
   - actividad permitida,
   - temática permitida,
   - espacio permitido según campus.
6. Obtiene fecha/hora Chile.
7. Busca un registro abierto del mismo RUN en `attendance_records` para ese día.
8. Si existe, devuelve `409`.
9. Si no existe, inserta registro con `estado: 'Dentro'`.
10. Vuelve a consultar registros del día y los devuelve al frontend.
11. El frontend re-renderiza tabla, mantiene campus/actividad, resetea el resto del formulario.

### Estado del flujo
- ✅ ESTABLE: validación básica sólida y reglas operativas explícitas.
- ‼️ RIESGO: se importa `cleanRun` y `cleanDv`, pero **no se usa** `isValidRut`; se valida formato, no validez real del RUN/DV.
- ‼️ RIESGO: `hora_entrada` se envía como timestamp ISO parcial (`YYYY-MM-DDTHH:mm:ss`), pero uno de los esquemas SQL espera `time without time zone` y otro `timestamptz`.
- ‼️ RIESGO: catálogos de campus, actividades, temáticas y espacios están hardcodeados en backend y duplicados parcialmente en frontend.

## 3.3 Registro de salida
1. El usuario pulsa el botón `Salida` en una fila activa.
2. `public/app.js` hace `POST /api/registrar-salida` con `{ id }`.
3. `api/registrar-salida.js` busca el registro del día por `id`.
4. Si no existe, devuelve `404`.
5. Si ya tiene `hora_salida`, devuelve `409`.
6. Si existe y sigue abierto, hace `PATCH` sobre `attendance_records` con `hora_salida` y `estado: 'Fuera'`.
7. Luego vuelve a cargar registros del día y los devuelve.
8. El frontend re-renderiza tabla y muestra mensaje de éxito.

### Estado del flujo
- ✅ ESTABLE: flujo claro y coherente con la pantalla principal.
- ‼️ RIESGO: la salida depende de que `id` y `dia` coincidan con “hoy” en Chile; cambios de zona horaria o inconsistencias de tipo en base pueden provocar falsos 404/409.

## 3.4 Carga de histórico / registros del día
### Lo que existe realmente
No existe un módulo formal de “histórico” separado. Lo que existe es:
- listado principal en `/api/registros-hoy`,
- dashboard en `/api/report-data`,
- exportaciones del día.

### Flujo actual de la pantalla principal
1. `public/app.js` llama `GET /api/registros-hoy` al cargar y al cambiar de campus.
2. El endpoint devuelve `registros` y también `debug`.
3. El frontend filtra localmente por campus usando `activeCampusFilter`.

### Estado del flujo
- ‼️ RIESGO: `api/registros-hoy.js` **no filtra por día**, pese a llamarse “registros-hoy”; solo ordena por `created_at desc` y limita a 20.
- ‼️ RIESGO: el filtrado por campus ocurre solo en frontend, no en backend.
- ‼️ RIESGO MVP: si la tabla crece, la pantalla puede mostrar registros que no correspondan realmente al día actual.
- No se detecta pantalla o endpoint de histórico multi-día real. **No confirmado** cualquier histórico fuera del día actual.

## 3.5 Informes
1. Desde la pantalla principal se abre `report.html` en otra pestaña.
2. `public/report.js` toma filtros iniciales desde query string.
3. Llama `GET /api/report-data?...`.
4. Renderiza KPIs, barras, gráfico, highlights y tabla.
5. Al cambiar filtros, vuelve a invocar el endpoint.

### Estado del flujo
- ✅ ESTABLE: la experiencia visual y el cálculo local del dashboard están bien separados.
- ‼️ RIESGO: `api/report-data.js` actualmente **ignora los filtros** y también **ignora el día**, porque la query fue reducida “temporalmente” a `select *`, `order by created_at desc`, `limit 20`.
- ‼️ RIESGO MVP: el dashboard puede aparentar exactitud mientras opera sobre datos incompletos o no filtrados.

## 3.6 Exportación

### Exportación CSV
1. `public/app.js` llama `GET /api/exportar-registros`.
2. El endpoint consulta `attendance_records` filtrando por `dia = hoy`.
3. Genera CSV UTF-8 con BOM.
4. Descarga archivo `ciac-registros-{dia}.csv`.

### Exportación Excel
1. `public/report.js` llama `GET /api/export-report` con filtros activos.
2. El endpoint sí aplica filtros por `dia`, `sede`, `tematica` y `actividad`.
3. Construye workbook con `xlsx`.
4. Descarga archivo `informe-uso-ciac-{dia}{sufijo}.xlsx`.

### Estado del flujo
- ✅ ESTABLE: ambos flujos existen y descargan archivos desde backend.
- ‼️ RIESGO: hay una asimetría clara entre `report-data` y `export-report`; el dashboard visual y el Excel pueden no representar el mismo subconjunto de datos.
- ‼️ RIESGO: el CSV exporta `nombre_completo` y `semestre_en_curso`, pero `nombre_completo` siempre queda vacío y `semestre_en_curso` se deriva localmente, no desde datos reales.

# 4. Riesgos técnicos

## 4.1 Dependencias frágiles
- ‼️ RIESGO: `xlsx` es una dependencia crítica para el informe Excel; si falla, no existe fallback.
- ‼️ RIESGO: `node-fetch` está declarado pero no se usa explícitamente; esto sugiere arrastre o dependencia histórica no limpiada.
- ‼️ RIESGO: el proyecto depende del `fetch` global del runtime Node. Si el entorno cambia, `lib/supabase.js` puede fallar.

## 4.2 Acoplamientos peligrosos
- ‼️ RIESGO: frontend y backend comparten catálogos de negocio por duplicación manual, no por fuente única.
  - Frontend: `public/app.js` (`CAMPUS_SPACES`).
  - Backend: `api/registrar.js` (`CAMPUS_OPTIONS`, `ACTIVITY_OPTIONS`, `TOPIC_OPTIONS`, `SPACE_OPTIONS`).
- ‼️ RIESGO: el dashboard depende de supuestos sobre timestamps (`new Date(record.hora_entrada)`), pero los esquemas SQL detectados no son consistentes entre sí.
- ‼️ RIESGO: el backend usa service role para todas las operaciones, acoplando el MVP a una credencial con privilegios elevados.

## 4.3 Duplicidad de lógica

### Duplicidad confirmada
- `getChileDate` repetido en:
  - `api/export-report.js`
  - `api/exportar-registros.js`
  - `api/registros-hoy.js`
  - `api/report-data.js`
- `getChileParts` / `getChileNow` repetido en:
  - `api/registrar.js`
  - `api/registrar-salida.js`
- `parseBody` repetido en:
  - `api/registrar.js`
  - `api/registrar-salida.js`
- `RECORD_SELECT` repetido con variantes en múltiples endpoints.
- escape/sanitización HTML duplicada en:
  - `public/app.js`
  - `public/report.js`
- Dos scripts SQL para la misma tabla:
  - `supabase-schema.sql`
  - `sql/attendance_records.sql`

### Impacto
- ‼️ RIESGO: cualquier ajuste de zona horaria, timestamps o columnas obliga a tocar múltiples archivos.
- ‼️ RIESGO: el esquema real de producción puede no coincidir con uno de los scripts de respaldo.

## 4.4 Endpoints confusos
- ‼️ RIESGO: `api/registros-hoy.js` y `api/report-data.js` contienen comentarios explícitos que indican que sus filtros fueron desactivados temporalmente para depuración. Eso sugiere que quedaron en un estado intermedio.
- ‼️ RIESGO: ambos endpoints responden con información de `debug`/diagnóstico que normalmente no debería formar parte del contrato del frontend productivo.
- ‼️ RIESGO: `api/buscar.js` responde `200` con `alumno: null` incluso ante error de backend, ocultando la causa del problema.

## 4.5 Configuraciones que podrían romper producción
- ‼️ RIESGO: la ausencia de filtros reales en endpoints de lectura puede mostrar datos incorrectos en producción.
- ‼️ RIESGO: `vercel.json` es demasiado mínimo para documentar o asegurar runtimes, headers o protecciones.
- ‼️ RIESGO: la documentación del `README.md` describe archivos que ya no existen (`lib/alumnos-data.js`, `lib/registros-store.js`) y omite archivos reales, lo que complica despliegue y mantenimiento.

## 4.6 Riesgos por variables de entorno
- ‼️ RIESGO: si falta `SUPABASE_SERVICE_ROLE_KEY`, el backend completo deja de operar.
- ‼️ RIESGO: la presencia de `NEXT_PUBLIC_SUPABASE_ANON_KEY` se diagnostica pero no resuelve nada funcionalmente en backend.
- ‼️ RIESGO: los endpoints de diagnóstico exponen si las variables están presentes o no, lo que puede revelar información operativa innecesaria.

## 4.7 Riesgos por cambios en Supabase
- ‼️ RIESGO: el proyecto usa REST manual y columnas explícitas; renombrar una columna o cambiar el tipo rompe varios endpoints.
- ‼️ RIESGO: la tabla `students_matrix` se asume con columnas `rut`, `dv`, `cohorte`, `carrera_ingreso`, `sede`; no existe adaptación si esa estructura cambia.
- ‼️ RIESGO MVP: la divergencia entre scripts SQL sugiere que la app podría estar funcionando contra una forma de tabla no documentada oficialmente en un solo lugar.

# 5. Deuda técnica

## 5.1 Partes improvisadas o parchadas
- `api/registros-hoy.js`: explícitamente reducido “temporalmente” a `select *, order by created_at desc, limit 20`.
- `api/report-data.js`: explícitamente con filtros desactivados “temporalmente”.
- `README.md`: conserva narrativa de una versión anterior del MVP, incluyendo archivos y persistencia que ya no existen.
- `api/buscar.js`: opta por no romper frontend ocultando errores reales como `alumno: null`.

## 5.2 Partes sostenibles
- `lib/supabase.js`: aunque básico, centraliza el acceso a Supabase y sí es reutilizable.
- `lib/rut.js`: helper limpio y pequeño; además expone `isValidRut`, aunque hoy no se usa.
- `public/app.js`: la UI principal está implementada de forma legible y relativamente modular dentro de las limitaciones de JavaScript plano.
- `public/report.js`: el dashboard está razonablemente separado y puede mantenerse si el backend vuelve a entregar datos correctos.

## 5.3 Partes no sostenibles si el proyecto crece
- catálogos de negocio hardcodeados en varios archivos,
- lógica de fechas/timestamps duplicada,
- contratos de API inconsistentes,
- ausencia de un único esquema SQL fuente de verdad,
- documentación operativa obsoleta,
- endpoints productivos mezclados con diagnósticos temporales.

# 6. Señales de que conviene reiniciar

Reiniciar desde cero estaría justificado si se confirmara una o varias de estas condiciones:

1. **El esquema real de Supabase ya no coincide con ninguno de los scripts SQL detectados.**
2. **Los endpoints actuales no pueden corregirse sin romper el frontend**, por ejemplo si hay dependencia fuerte de respuestas de depuración o de formatos inconsistentes.
3. **Se requiere un rediseño mayor del dominio**, como múltiples sedes, múltiples tipos de usuario, autenticación o histórico real por periodos.
4. **La base de datos fue parchada manualmente varias veces** y no existe migración confiable. Esto hoy es una sospecha razonable por la coexistencia de dos esquemas distintos, pero no queda completamente confirmado.
5. **Se necesita trazabilidad fuerte, seguridad o multirrol**: la arquitectura actual con service role en backend y sin capas adicionales puede quedarse corta.
6. **Si en producción ya existen errores sistémicos de tipos de fecha/hora** entre frontend, API y Supabase.

# 7. Señales de que NO conviene reiniciar

1. ✅ El proyecto es pequeño y todavía comprehensible de punta a punta.
2. ✅ La separación principal frontend/API/lib ya existe.
3. ✅ El helper de Supabase está centralizado.
4. ✅ Los flujos base del MVP ya están resueltos: búsqueda, entrada, salida, exportación, dashboard.
5. ✅ La UI ya materializa el caso de negocio y puede reutilizarse casi íntegramente.
6. ✅ La mayoría de los problemas detectados son de consistencia, contrato y depuración residual, no de complejidad extrema.

# 8. Veredicto técnico final

## REFACTORIZAR PARCIALMENTE

### Justificación concreta
No recomiendo **MANTENER Y ESTABILIZAR** sin refactor porque el proyecto ya contiene problemas estructurales reales:
- `registros-hoy` y `report-data` están en modo diagnóstico temporal.
- existe duplicidad de esquema SQL.
- la documentación principal contradice el código actual.
- hay duplicación de catálogos y utilidades de fecha.
- hay inconsistencias de contrato entre el dashboard visible y la exportación Excel.

Tampoco recomiendo **REINICIAR DESDE CERO** porque:
- el tamaño del código sigue siendo reducido,
- la lógica central no está dispersa en demasiados módulos,
- hay partes sanas y reutilizables,
- los flujos principales ya están implementados.

### Criterio final
La opción técnicamente más razonable es:

> **REFACTORIZAR PARCIALMENTE** para consolidar contratos, unificar esquema y helpers, eliminar endpoints temporales/diagnósticos y estabilizar los flujos reales del MVP.

# 9. Plan recomendado

## 9.1 Acciones inmediatas
1. Congelar cambios funcionales nuevos hasta corregir contratos de datos.
2. Definir una única fuente de verdad para el esquema de `attendance_records`.
3. Confirmar en Supabase los tipos reales de `dia`, `hora_entrada`, `hora_salida`, `created_at` y columnas opcionales.
4. Revisar en producción si `registros-hoy` y `report-data` están devolviendo datos fuera de día/filtro.
5. Respaldar variables de entorno y estructura real de tablas antes de tocar lógica.

## 9.2 Acciones de estabilización
1. Rehabilitar filtros reales en `api/registros-hoy.js` y `api/report-data.js`.
2. Remover o encapsular la salida `debug` de endpoints productivos.
3. Extraer helpers compartidos:
   - fechas Chile,
   - parseo de body,
   - catálogos de negocio,
   - `RECORD_SELECT` común.
4. Usar `isValidRut` o eliminar la falsa sensación de validación completa.
5. Alinear dashboard, exportación Excel y CSV al mismo subconjunto de datos.
6. Corregir `README.md` para que refleje el proyecto real.

## 9.3 Acciones de respaldo
1. Exportar estructura y datos de `attendance_records`.
2. Exportar muestra o esquema de `students_matrix`.
3. Guardar variables de entorno efectivas en un vault seguro.
4. Conservar scripts SQL, aunque hoy estén inconsistentes, hasta decidir cuál refleja la realidad.
5. Capturar ejemplos reales de payloads/responses de los endpoints principales.

## 9.4 Acciones de mejora
1. Centralizar catálogos en archivo compartido.
2. Introducir validación común de payloads.
3. Tipar contratos o, al menos, documentarlos formalmente.
4. Evaluar uso del SDK oficial de Supabase en vez de REST manual, si el proyecto va a crecer.
5. Separar claramente endpoints productivos de endpoints de diagnóstico.
6. Considerar histórico real por rango de fechas si el producto lo necesita.

# 10. Archivos críticos a respaldar

## Código y configuración
- `lib/supabase.js`
- `lib/rut.js`
- `api/buscar.js`
- `api/registrar.js`
- `api/registrar-salida.js`
- `api/registros-hoy.js`
- `api/report-data.js`
- `api/exportar-registros.js`
- `api/export-report.js`
- `public/index.html`
- `public/app.js`
- `public/report.html`
- `public/report.js`
- `public/styles.css`
- `package.json`
- `vercel.json`

## SQL y estructura de datos
- `supabase-schema.sql`
- `sql/attendance_records.sql`

## Archivos sospechosos o muertos a marcar
- `README.md`: **sospechoso/desactualizado** respecto al estado real del repo.
- `node-fetch` en `package.json`: **posible residuo** si el runtime ya aporta `fetch` global.
- `supabase-schema.sql` y `sql/attendance_records.sql`: **duplicidad crítica**; uno de los dos puede ser residuo o ambos estar parcialmente obsoletos.

## Resumen final de decisión
- **Mantener tal cual:** no recomendado.
- **Refactorizar parcialmente:** recomendado.
- **Reiniciar desde cero:** solo si al validar Supabase real se confirma que la base productiva ya no coincide con el contrato que este código asume.
