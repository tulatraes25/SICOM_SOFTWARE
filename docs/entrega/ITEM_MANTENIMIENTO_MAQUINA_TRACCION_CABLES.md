# SICOM — Checklist: Estado de máquina de tracción y cables

Solicitud de Agustina Forquera: agregar un ítem al mantenimiento que cargan los técnicos.

## Campo exacto

**Estado de máquina de tracción y cables**

- Se agrega como undécimo ítem al checklist de mantenimiento del técnico.
- Usa los resultados existentes: `OK`, `Observado`, `Requiere intervención`, `No aplica`.
- Permite cargar una observación textual sobre la inspección, igual que el resto de los ítems.
- Para ascensores sin máquina de tracción/cables (p. ej. configuración hidráulica sin cables de tracción), el técnico puede seleccionar `No aplica`.
- El nuevo ítem se inicia como `No aplica` y **nunca se declara OK de manera automática**.

## Trazabilidad

- Un borrador creado con la versión anterior adquiere el nuevo ítem cuando vuelve a abrirse para editar, conservando íntegramente los anteriores, sus notas y estados.
- Un mantenimiento `submitted`, `in_review`, `approved` o `rejected` no recibe automáticamente el ítem ni se reescribe: mantiene la evidencia de lo que realmente fue inspeccionado en su momento.
- Al guardar un borrador, el ítem se almacena en `service_checklist_items` igual que cualquier otro elemento del checklist.
- En **Revisión de Servicios**, el equipo administrativo ve los resultados guardados; la generación de PDF aprobado muestra el ítem y la nota cuando están presentes.
- El QR público conserva su vista de fecha y estados generales, **sin checklist ni observaciones internas**.
- Este cambio **no requiere migración SQL**: `service_checklist_items.item_name` es texto y los estados posibles ya están admitidos por la base de datos.

## Prueba operativa en SICOM

1. Iniciar un mantenimiento real de un ascensor. Verificar que el técnico vea «Estado de máquina de tracción y cables» con `No aplica` inicial.
2. Seleccionar el resultado correcto y escribir una nota cuando corresponda. Guardar borrador, salir y volver a entrar: el valor y la nota deben conservarse.
3. Enviar a revisión, revisar desde usuario admin/supervisor. Comprobar que aparece el ítem.
4. Si se aprueba el mantenimiento real, verificar que el PDF final incluya el resultado y la nota, y que el QR **no** publique el checklist.
5. Abrir un mantenimiento histórico aprobado: no debe aparecer un estado fabricado para el ítem nuevo.

No insertar datos ficticios, no cambiar ni volver a aprobar mantenimientos anteriores, no ejecutar SQL.
