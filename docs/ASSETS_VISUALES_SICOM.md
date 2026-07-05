# Assets Visuales - SICOM Patagonia Ascensores

## Estado: ✅ IMÁGENES REALES INCORPORADAS

---

## Ubicación de Imágenes

Todas las imágenes reales PNG están en: `public/images/sicom/`

## Archivos

| Archivo | Tamaño | Uso |
|---------|--------|-----|
| `01_hero_sicom_tecnologia_ascensores.png` | 662 KB | Hero principal, fondo login |
| `02_tecnico_mantenimiento_cabina.png` | 678 KB | Servicio técnico |
| `03_sala_maquinas_motor_poleas.png` | 641 KB | Sala de máquinas |
| `04_tablero_control_digital.png` | 573 KB | Tablero de control |
| `05_qr_estado_ascensor.png` | 619 KB | Consulta QR |
| `06_operario_revisando_motor.png` | 676 KB | Reparación |
| `07_cabina_modernizada_premium.png` | 683 KB | Modernización |
| `08_supervisor_informe_pdf.png` | 605 KB | Informes PDF |
| `09_dashboard_estados_mantenimiento.png` | 558 KB | Dashboard |
| `10_historial_digital_libro_interno.png` | 599 KB | Historial |
| `logo_original_sicom.png` | 94 KB | Logo original |
| `logo_sicom_512_transparent.png` | 43 KB | Logo 512px |

## Constantes (src/config/assets.ts)

```typescript
import { SICOM_IMAGES } from '@/config/assets';

// Ejemplo de uso
<img src={SICOM_IMAGES.hero} alt="Hero" />
<img src={SICOM_IMAGES.technician} alt="Técnico" />
```

## Uso en Pantallas

| Pantalla | Imágenes |
|----------|----------|
| Login | hero (fondo), logo |
| Vista Pública QR intro | hero, logo |
| Vista Pública QR ficha | logo |
| Servicios | technician, motorWork, modernCabin, reports |
| Galería | machineRoom, technician, modernCabin, reports |
| Dashboard | dashboard (opcional) |
| PDF | logo (SVG) |
| Correo | Texto (no imágenes) |

## Paleta de Colores

| Color | Hex | Uso |
|-------|-----|-----|
| Navy | `#06172E` | Fondo principal |
| Blue | `#0B5C8F` | Gradientes |
| Cyan | `#17B3E2` | Acentos |
| Green | `#8DB600` | Botones SICOM |

## Notas

- Imágenes PNG reales, no placeholders
- Todas las rutas verificadas en `src/config/assets.ts`
- Responsive con `object-cover`
- Lazy loading en galería
