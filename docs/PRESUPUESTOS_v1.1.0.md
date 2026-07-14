# Presupuestos Vinculados al Expediente — v1.1.0

## Objetivo

Crear el módulo completo de presupuestos vinculados al expediente maestro.

## Relación con expediente

El presupuesto **no genera número propio**. Utiliza `service_cases.case_number`:
- `Presupuesto — PRUEBA N.º 1902`
- `Presupuesto — N.º 2000`

## Tablas

| Tabla | Descripción |
|-------|-------------|
| `budgets` | Presupuesto principal |
| `budget_items` | Ítems del presupuesto |
| `budget_email_sends` | Historial de envíos |

## Estados

| Estado | Descripción |
|--------|-------------|
| `draft` | Borrador, editable |
| `ready` | Listo para enviar |
| `sent` | Enviado al cliente |
| `accepted` | Aceptado por cliente |
| `rejected` | Rechazado |
| `expired` | Vencido |
| `cancelled` | Cancelado |

## Cálculos

```
subtotal = Σ(line_subtotal)
tax_amount = subtotal × tax_rate / 100
total = subtotal + tax_amount
```

## RPCs

| RPC | Permisos |
|-----|----------|
| `create_budget()` | admin, supervisor |
| `recalculate_budget_totals()` | authenticated |
| `mark_budget_ready()` | authenticated |
| `mark_budget_sent()` | authenticated |
| `accept_budget()` | authenticated |
| `reject_budget()` | authenticated |
| `cancel_budget()` | authenticated |

## Archivos creados

- `supabase/migrations/033_budgets_module.sql`
- `src/services/budgets.service.ts`
- `src/services/budgetEmail.service.ts`
- `src/pages/admin/BudgetsPage.tsx`
- `src/pages/admin/BudgetCreatePage.tsx`
- `src/pages/admin/BudgetDetailPage.tsx`
- `src/test/budgets.test.ts`

## SQL manual

```sql
-- Ejecutar en Supabase SQL Editor:
-- supabase/migrations/033_budgets_module.sql
```
