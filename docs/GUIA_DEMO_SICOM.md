# Guía de Demo - SICOM Patagonia Ascensores

## Objetivo
Mostrar el sistema completo de trazabilidad de ascensores con código QR, desde la carga de datos hasta el envío de informes por correo.

---

## Preparación Previa

### Datos de usuario para demo
| Email | Contraseña | Rol |
|-------|------------|-----|
| admin@sicom.com | (definir) | Administrador |
| tecnico@sicom.com | (definir) | Técnico |
| supervisor@sicom.com | (definir) | Supervisor |
| responsable@sicom.com | (definir) | Responsable |

### Datos precargados
- 3 clientes
- 3 edificios  
- 3 ascensores con QR generado
- Destinatarios configurados

---

## Guion Paso a Paso

### PARTE 1: Administración (5 min)

**1.1 Login como Administrador**
```
URL: [dominio]/login
Email: admin@sicom.com
Contraseña: [definir]
```
- Verificar acceso al panel de administración
- Mostrar estadísticas del dashboard

**1.2 Visualizar Clientes**
```
Menú: Clientes
```
- Mostrar listado de clientes precargados
- Destacar: Hospital Regional, Consorcio Edificio Centro, Inmobiliaria Patagonia

**1.3 Visualizar Edificios**
```
Menú: Edificios
```
- Mostrar edificios asociados a clientes
- Verificar que muestran cliente correctly

**1.4 Visualizar Ascensores**
```
Menú: Ascensores
```
- Mostrar listado con estados
- Destacar ASC-0001 (Hospital Regional)

**1.5 Ver Código QR**
```
Acción: Clic en ícono QR de ASC-0001
```
- Mostrar modal con QR generado
- Copiar URL pública
- Descargar QR como PNG
- Explicar: "Cada ascensor tiene un QR único"

---

### PARTE 2: Vista Pública QR (3 min)

**2.1 Abrir URL pública**
```
Acción: Abrir URL copiada en nueva pestaña
```
- Mostrar pantalla institucional de SICOM
- Verificar: logo, nombre, eslogan

**2.2 Ver Estado del Ascensor**
```
Acción: Clic en "Ver estado del ascensor"
```
- Mostrar ficha pública:
  - Código del ascensor
  - Ubicación (edificio, dirección)
  - Estado operativo
  - Estado de conservación
  - Último mantenimiento
- Verificar que NO se muestra información sensible

**2.3 Verificar en Celular**
```
Acción: Escanear QR con celular
```
- Mostrar que funciona en móvil
- Verificar diseño responsive

---

### PARTE 3: Técnico (5 min)

**3.1 Login como Técnico**
```
URL: [dominio]/login
Email: tecnico@sicom.com
```
- Verificar acceso a panel técnico

**3.2 Buscar Ascensor**
```
Menú: Buscar Ascensor
```
- Buscar "ASC-0001"
- Seleccionar el ascensor

**3.3 Cargar Mantenimiento**
```
Acción: Clic en "Cargar Mantenimiento"
```
- Fecha: fecha actual
- Tipo: Preventivo
- Checklist: marcar todos como "OK"
- Descripción: "Se realizó mantenimiento preventivo según protocolo"
- Observaciones: "Equipo en buen estado general"
- Mini informe: "Se revisaron puertas, botones, iluminación y sala de máquinas. Todo funciona correctamente."

**3.4 Enviar a Revisión**
```
Acción: Clic en "Enviar a Revisión"
```
- Confirmar envío
- Verificar que el registro aparece como "Enviado"

---

### PARTE 4: Supervisor (8 min)

**4.1 Login como Supervisor**
```
URL: [dominio]/login
Email: supervisor@sicom.com
```
- Verificar acceso a panel supervisor
- Mostrar estadísticas pendientes

**4.2 Revisar Mantenimiento**
```
Menú: Revisiones
```
- Abrir el registro enviado por el técnico
- Verificar checklist, observaciones e informe

**4.3 Generar Informe con IA**
```
Acción: Clic en "Generar Informe con IA"
```
- Esperar generación
- Mostrar informe generado
- Explicar: "La IA genera un borrador, el supervisor siempre revisa"

**4.4 Editar Informe**
```
Acción: Editar texto del informe
```
- Modificar alguna parte
- Guardar borrador

**4.5 Aprobar Informe**
```
Acción: Clic en "Aprobar Informe"
```
- Confirmar aprobación
- Verificar que el estado del ascensor se actualiza

**4.6 Generar PDF**
```
Menú: Informes Mensuales → Seleccionar informe
Acción: Clic en "Descargar PDF"
```
- Mostrar PDF generado
- Verificar que es PDF real (no HTML)
- Descargar

**4.7 Enviar por Correo**
```
Acción: Clic en "Enviar por Correo"
```
- Verificar destinatarios
- Enviar
- Mostrar registro de envío

---

### PARTE 5: Responsable (3 min)

**5.1 Login como Responsable**
```
URL: [dominio]/login
Email: responsable@sicom.com
```
- Verificar acceso a panel responsable

**5.2 Ver Ascensores Asignados**
```
Panel: Mis Ascensores
```
- Mostrar ascensores asignados
- Verificar estados

**5.3 Ver Informes**
```
Panel: Informes Disponibles
```
- Mostrar informes aprobados
- Descargar PDF

---

## Tiempo Total Estimado: 24 minutos

---

## Puntos Clave a Destacar

1. **QR Único**: Cada ascensor tiene un código QR único y no predecible
2. **Vista Pública**: Solo muestra información limitada, sin datos sensibles
3. **Flujo Controlado**: Técnico carga → Supervisor revisa → IA asiste → Aprobación humana
4. **PDF Real**: No es HTML, es un PDF descargable y almacenable
5. **Trazabilidad**: Todo queda registrado (quién hizo qué, cuándo)
6. **Multi-rol**: Cada rol tiene acceso según su función
7. **Identidad Visual**: Logo y colores institucionales de SICOM

---

## Preguntas Frecuentes del Cliente

**¿Puede el técnico aprobar informes?**
No. Solo el supervisor puede aprobar.

**¿El público ve todo el historial?**
No. Solo ve estado actual y último mantenimiento.

**¿Se puede personalizar el PDF?**
Sí. La plantilla se puede adaptar.

**¿Funciona en celular?**
Sí. Todo el sistema es responsive.

**¿Cuánto cuesta por ascensor?**
(Eso es commercial, no técnico)

---

## Credenciales para Demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@sicom.com | [definir] |
| Técnico | tecnico@sicom.com | [definir] |
| Supervisor | supervisor@sicom.com | [definir] |
| Responsable | responsable@sicom.com | [definir] |
