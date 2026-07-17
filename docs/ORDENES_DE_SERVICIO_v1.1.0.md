# Órdenes de Servicio — v1.1.0

## Migración

`039_service_orders_module.sql`

## Tablas

| Tabla | Descripción |
|-------|-------------|
| `service_orders` | Orden principal |
| `service_order_technicians` | Técnicos asignados (multi-tec, 1 lead) |
| `service_order_events` | Historial de eventos |
| `service_order_progress` | Avances del trabajo |

## Estados

```
draft → ready → assigned → in_progress → visited → completed
  ↘       ↘        ↘          ↘
  cancelled cancelled cancelled cancelled
```

## RPCs

| RPC | Permisos |
|-----|----------|
| `create_service_order()` | admin, supervisor |
| `mark_service_order_ready()` | admin, supervisor |
| `assign_service_order_technicians()` | admin, supervisor |
| `start_service_order()` | admin, supervisor, technician (asignado) |
| `complete_service_order()` | admin, supervisor, technician (lead) |
| `cancel_service_order()` | admin, supervisor |
| `add_service_order_progress()` | admin, supervisor, technician (asignado) |

## Alarma sidebar técnico

- "Mis Órdenes" con alarma roja cuando hay órdenes assigned
- Mismo patrón que "Mis Reclamos"
- Desaparece al iniciar trabajo

## SQL manual

```sql
-- Ejecutar en Supabase SQL Editor:
-- supabase/migrations/039_service_orders_module.sql
```
