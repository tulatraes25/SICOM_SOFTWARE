# Guía de Gestión de Expedientes — SICOM

## ¿Qué es un expediente?

Un expediente es el registro maestro que agrupa toda la información relacionada con un ascensor: presupuestos, reclamos, órdenes de servicio, informes y visitas. Cada expediente tiene un número único secuencial que se conserva indefinidamente.

## Orígenes disponibles

| Origen | Descripción |
|--------|-------------|
| Presupuesto | Generado desde un presupuesto |
| Reclamo | Generado desde un reclamo |
| Informe directo | Creado directamente por un administrador |
| **Informe técnico preliminar** | Informe técnico previo a la intervención |
| Servicio programado | Vinculado a un servicio programado |
| Orden de servicio | Vinculado a una orden de servicio |
| Otro | Origen no especificado |

**Diferencia entre Informe directo e Informe técnico preliminar:**
- **Informe directo**: registro general sin análisis previo.
- **Informe técnico preliminar**: contiene análisis técnico inicial antes de la intervención.

## Estados del expediente

| Estado | Descripción |
|--------|-------------|
| Abierto | Creado, pendiente de asignación |
| Asignado | Asignado a un técnico |
| En curso | En proceso de atención |
| Completado | Trabajo finalizado |
| Cerrado | Archivado definitivamente |
| Anulado | Descartado (conserva número) |

## Matriz de transiciones

```
Abierto      → Asignado, En curso, Cerrado, Anulado
Asignado     → Abierto, En curso, Cerrado, Anulado
En curso     → Asignado, Completado, Cerrado, Anulado
Completado   → En curso, Cerrado, Anulado
Cerrado      → Abierto (solo Admin + motivo)
Anulado      → Abierto (solo Admin + motivo)
```

## Cómo editar un expediente

1. Abrir el expediente desde la lista.
2. Presionar **Editar**.
3. Modificar los campos permitidos según el estado.
4. Guardar.

**Restricciones por estado:**
- **Abierto, Asignado, En curso**: todos los campos editables.
- **Completado**: solo título y descripción. Para otros campos, volver a En curso.
- **Cerrado**: no editable. Reabrir primero.
- **Anulado**: no editable. Reactivar primero.

## Cómo asignar un expediente

1. Abrir el expediente en estado Abierto.
2. Presionar **Asignar**.
3. Seleccionar el técnico.
4. Confirmar.

## Cómo cambiar de estado

Desde el detalle del expediente, use los botones según el estado actual:
- **Iniciar**: pasa a En curso.
- **Marcar completado**: pasa a Completado.
- **Cerrar**: pasa a Cerrado.
- **Volver a En curso**: desde Completado.

## Cómo anular un expediente

1. Abrir el expediente.
2. Presionar **Anular**.
3. Ingresar el motivo (obligatorio).
4. Confirmar.

El expediente conserva su número y todo su historial.

## Por qué el número anulado permanece

Los expedientes numerados son registros auditablees. La numeración es secuencial e irreversible. Un número anulado no se reutiliza ni se recupera. Esto garantiza trazabilidad completa.

## Cómo reactivar un expediente anulado

1. Abrir el expediente anulado.
2. Presionar **Reactivar**.
3. Ingresar el motivo (obligatorio).
4. Confirmar.

El expediente vuelve a estado Abierto conservando su número original.

## Cómo reabrir un expediente cerrado

1. Abrir el expediente cerrado.
2. Presionar **Reabrir**.
3. Ingresar el motivo (obligatorio).
4. Confirmar.

El expediente vuelve a estado Abierto.

## Por qué no se eliminan físicamente

Los expedientes son documentos legales y operativos. Su eliminación física:
- Rompería la secuencia de numeración.
- Eliminaría evidencia de auditoría.
- Impediría consultas históricas.

La acción equivalente es **Anular**, que conserva todo el registro.

## Filtrado en el listado

El listado de expedientes permite filtrar por:
- Estado (Abierto, Asignado, En curso, Completado, Cerrado, Anulado)
- Origen
- Modo (Prueba / Producción)
- Búsqueda por número o título

Los expedientes anulados son accesibles mediante el filtro "Anulado".
