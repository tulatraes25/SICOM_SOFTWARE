# SICOM — Dos instancias independientes de revisión

## Motivación (prueba real NATANIA)

En la prueba con el ascensor ASC-22/01, el técnico registró un mantenimiento preventivo con fecha 21/10/2026. El personal administrativo observó que el QR público todavía no indicaba la intervención mientras el parte seguía pendiente de revisión.

**La fecha de la visita y la fecha de aprobación son datos diferentes.** Se publica la fecha real `service_records.service_date`, una vez que un administrador o supervisor haya validado el registro; no se espera la aprobación del informe mensual.

## Etapa 1 — Validación de mantenimiento (QR público)

1. Técnico completa el checklist, los estados y las observaciones; envía el registro (`submitted`).
2. Administración/Supervisión revisa en **Revisión de Servicios → Pendientes**.
3. **Aprobar mantenimiento y actualizar QR** llama a la RPC existente `approve_service_record`. La base marca `service_records.status=approved`, identifica aprobador/fecha y actualiza `elevators.last_service_date` con **la fecha del servicio**. También actualiza `operational_status` y `conservation_status` al estado validado.
4. El QR público consulta `get_public_elevator_by_token`, que expone únicamente la fecha del último mantenimiento validado y los estados, sin mostrar el PDF ni el historial detallado.
5. Si el trabajo se rechaza, se exige una razón; **no** se publica ese mantenimiento como aprobado.
6. La pantalla de revisión muestra la fecha almacenada en el ascensor. Si no puede verificarla, advierte que falta confirmar la sincronización: no atribuir el cambio de estado/fecha al QR solo porque la RPC haya respondido.

**No se aprueba ni envía el informe mensual en esta etapa.** El QR no certifica que el equipo no tenga observaciones. Un estado de conservación `requiere_reparacion` sigue siendo relevante aun si el estado operativo dice `operativo`.

## Etapa 2 — Informe mensual y envío

1. Desde **Revisión de Servicios → Informes mensuales** se accede a los informes existentes; el vínculo desde un mantenimiento filtra el ascensor y período.
2. Si no hay informe, **Crear informe mensual** lleva al flujo existente de Informes Mensuales.
3. El sistema reúne solo mantenimientos `approved` para el período (además de otras órdenes/registros compatibles según el flujo de informes).
4. Se genera/revisa el PDF. La aprobación del **informe mensual** es una operación independiente que habilita el envío posterior a los destinatarios habilitados.
5. No se envía correo automáticamente al validar un mantenimiento ni al aprobar el PDF; el envío requiere acción explícita.
6. El envío individual de un parte técnico, cuando corresponda, se presenta como una operación diferenciada y exige confirmación; no reemplaza el informe mensual.

## Prueba operativa obligatoria

Con un mantenimiento real pendiente del ASC-22/01: antes de aprobar, el QR no debe publicar la nueva visita. Al validar el mantenimiento, comprobar que `service_records.status='approved'`, que `elevators.last_service_date` contenga 2026-10-21 si es el más reciente aprobado, y que el QR muestre esa misma fecha sin PDF ni historial privado. Confirmar que no se ha aprobado ni enviado un informe mensual en esta acción. Si hay otro mantenimiento aprobado más reciente, la fecha QR debe corresponder al último validado, no necesariamente a esta intervención.

Después acceder al período desde el botón **Ver informe mensual del ascensor**, revisar el PDF en el módulo existente, aprobarlo y recién entonces ejecutar el envío manual. Verificar separación de auditorías entre aprobación de servicio y de documento.

**No crear mantenimientos ficticios en producción y no aprobar el mantenimiento de NATANIA automáticamente.** Debe aprobarlo una persona autorizada después de revisar los datos reales.

## Despliegue / retroceso

Esta actualización es exclusivamente frontend + tests y documentación: **sin migración SQL, sin cambios de esquema y sin escrituras automáticas de datos**. Si hay un defecto de interfaz se revierte el commit mediante `git revert` en una rama/PR nueva y se redepliega; no hacer `git reset --hard` ni `push --force`. La lógica SQL histórica no se sustituye: para desviaciones reales entre fecha aprobada y QR se requiere diagnosticar la RPC productiva con consultas de solo lectura antes de proponer una migración.
