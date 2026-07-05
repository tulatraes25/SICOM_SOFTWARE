# Etapa 4: QR Real y Vista Pública del Ascensor

## Objetivo

Implementar la generación real del código QR por ascensor, la URL pública por token, la vista pública de consulta y la pantalla institucional previa de SICOM Patagonia SRL.

---

## 1. Generación de QR

### Librería utilizada
- `qrcode.react` v4.2.0 (ya instalada en Etapa 1)

### URL pública
```
VITE_PUBLIC_APP_URL=/s/ascensor/{qr_token}
```

Ejemplo:
```
https://sicom-demo.vercel.app/s/ascensor/x7Kp92Ls
```

### Generación de tokens
- Tokens de 12 caracteres alfanuméricos
- Generados automáticamente al crear ascensor
- No secuenciales, no predecibles
- Almacenados en campo `qr_token` de tabla `elevators`

---

## 2. Componentes Creados

### `src/components/qr/ElevatorQRCode.tsx`
Componente reutilizable que muestra:
- Código QR con la URL pública
- Código visible del ascensor
- URL pública (opcional)
- Botón copiar URL
- Botón descargar PNG
- Botón imprimir

**Props:**
```typescript
interface ElevatorQRCodeProps {
  qrToken: string;
  elevatorCode: string;
  size?: number;          // Default: 200
  showUrl?: boolean;      // Default: true
  allowDownload?: boolean; // Default: true
  allowPrint?: boolean;    // Default: true
}
```

### `src/components/qr/ModalQR.tsx`
Modal que contiene el componente QR para visualización rápida desde el admin.

---

## 3. Vista Pública

### Ruta
```
/s/ascensor/:token
```

### Flujo
1. Usuario escanea QR
2. Se muestra pantalla institucional de SICOM (3 segundos o clic para continuar)
3. Se muestra ficha pública limitada del ascensor

### Pantalla Institucional
- Logo/ícono de SICOM
- Nombre: SICOM Patagonia SRL
- Texto: "Mantenimiento, reparación, modernización y asistencia técnica de ascensores."
- Cobertura: "Comodoro Rivadavia y Patagonia."
- Botón: "Ver estado del ascensor"

### Ficha Pública
Información mostrada:
- ✅ Código del ascensor
- ✅ Fabricante y modelo
- ✅ Edificio y dirección
- ✅ Localidad
- ✅ Estado operativo
- ✅ Estado de conservación
- ✅ Estado contractual
- ✅ Último mantenimiento (si existe)
- ✅ Fecha de última actualización
- ✅ Contacto de SICOM

Información NO mostrada:
- ❌ Historial completo
- ❌ Informes completos
- ❌ Destinatarios
- ❌ Responsable autorizado
- ❌ Datos internos
- ❌ Notas internas
- ❌ Auditoría
- ❌ Presupuestos
- ❌ UUID real del ascensor

---

## 4. Servicios

### `src/services/publicElevator.service.ts`

**Funciones:**
- `getPublicElevatorByToken(token)` - Busca ascensor activo por qr_token
- `logQRScan(token, elevatorId)` - Registra escaneo (falla silenciosa)

---

## 5. Migración SQL

### `supabase/migrations/002_qr_scan_logs.sql`

Tabla `qr_scan_logs` para registro de escaneos:
- `id` (UUID, PK)
- `elevator_id` (UUID, FK)
- `qr_token` (TEXT)
- `scanned_at` (TIMESTAMPTZ)
- `user_agent` (TEXT)
- `ip_address` (INET, opcional)
- `referrer` (TEXT, opcional)

**RLS:**
- Permite inserción anónima (para registrar escaneos)
- Solo admin puede ver los logs

---

## 6. Descarga PNG

El componente QR permite descargar el código como PNG:
1. Se renderiza el SVG a un Canvas
2. Se agrega texto: código del ascensor e instrucciones
3. Se descarga como `SICOM_QR_ASC-0001.png`

---

## 7. Impresión

Al hacer clic en "Imprimir":
1. Se abre una ventana nueva
2. Se muestra el QR con código e instrucciones
3. Se abre el diálogo de impresión del navegador

---

## 8. Cómo Probar

### Generar QR desde Admin
1. Ir a `/admin/ascensores`
2. Hacer clic en el ícono QR de un ascensor
3. Verificar que se abre el modal con el QR
4. Probar copiar URL
5. Probar descargar PNG
6. Probar imprimir

### Probar Vista Pública
1. Copiar la URL del QR
2. Abrir en navegador (o escanear con teléfono)
3. Verificar pantalla institucional
4. Hacer clic en "Ver estado del ascensor"
5. Verificar ficha pública
6. Probar en tamaño móvil

### Probar Token Inexistente
1. Ir a `/s/ascensor/token-invalido`
2. Verificar mensaje de error

---

## 9. Variables de Entorno

```env
# URL pública para QR (IMPORTANTE: configurar en producción)
VITE_PUBLIC_APP_URL=https://tu-dominio.com
```

---

## 10. Seguridad

- El QR solo contiene el `qr_token`, no el UUID real
- La vista pública solo muestra campos permitidos
- Los escaneos se registran pero no bloquean la vista
- RLS permite lectura pública limitada por qr_token
- No se exponen datos sensibles del cliente o responsable

---

## 11. Limitaciones de Esta Etapa

- No hay carga de mantenimientos aún
- No hay informes con IA
- No hay PDF
- No hay envío de correos
- El último mantenimiento se muestra solo si existe en `service_records`

---

## 12. Pendientes para Etapa 5

- Carga técnica de mantenimientos por técnico
- Checklist de servicios
- Fotos antes/después
- Estados de servicio (draft, submitted, approved)
- Asignación de técnico al servicio
