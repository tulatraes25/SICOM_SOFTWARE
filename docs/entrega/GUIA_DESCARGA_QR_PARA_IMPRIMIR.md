# SICOM — Descargar imagen QR para colocar en ascensores

## Objetivo

Permitir a Administración descargar una **etiqueta PNG de alta resolución** de cada ascensor, imprimirla y colocarla junto al equipo, sin cambiar ni regenerar el token del QR ya existente.

## Uso

1. Abrir **Ascensores** desde una cuenta de administrador.
2. En la fila del ascensor deseado, pulsar el botón visible **QR PNG**.
3. Verificar el código de ascensor en la previsualización.
4. Presionar **Descargar QR (PNG)**. Se guarda `SICOM_QR_<codigo_sanitizado>.png`; ejemplo `SICOM_QR_ASC-22_01.png`.
5. Imprimir a un **ancho físico aproximado de 8–10 cm**. Mantener el fondo y margen blanco libre alrededor del QR.
6. **Escanear la etiqueta impresa con un teléfono antes de pegarla** y verificar que abre la ficha pública correcta del ascensor.
7. Colocar la etiqueta en superficie limpia, estable, visible y protegida del desgaste, la humedad y la luz intensa.

El archivo PNG es de 1200 px de ancho por 1440 px de alto, con un QR de 1020 px, código del equipo, indicación de escaneo y SICOM Patagonia SRL. A 10 cm de ancho, 1200 píxeles corresponden aproximadamente a 305 píxeles por pulgada; las impresoras pueden interpretar dimensiones distintas si no se configura manualmente el tamaño.

## Seguridad e integridad

- El PNG se genera **localmente en el navegador** desde el mismo SVG que ve el usuario.
- Se conserva el valor público `getElevatorPublicUrl(qrToken)`; no hay nuevas escrituras en Supabase, rotación de token ni QR duplicados.
- La imagen contiene solo el identificador visible y la URL codificada del QR público.
- No se exportan historial técnico, checklist, PDF, datos personales ni credenciales.
- No requiere migración SQL, cambios de permisos RLS ni servidor externo.
- Los códigos con barra (`ASC-22/01`) reciben un nombre de archivo portable (`ASC-22_01`) sin modificar el código en la imagen.

## Verificación funcional

- Comprobar descarga para un ascensor real, previsualizar el PNG y escanearlo.
- Comprobar que la URL del QR descargado es igual a la del QR ya colocado, y que el ascensor mostrado es el correcto.
- Probar en notebook a 1366×768 y navegador móvil; si el navegador bloquea la descarga, el modal conserva la alternativa **Imprimir**.
- La descarga no debe modificar `elevators`, `qr_token`, fechas de mantenimiento ni registros auditables.

## Retroceso

Si una versión de interfaz causa problemas, revertir el commit con `git revert` mediante PR y redeplegar. No borrar etiquetas existentes ni alterar registros en Supabase: el QR anterior continúa siendo válido.
