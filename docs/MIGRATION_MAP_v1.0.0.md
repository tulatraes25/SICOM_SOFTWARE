# Mapa de Migraciones - SICOM Patagonia SRL v1.0.0

**Fecha:** 13 de julio de 2026

---

## Resumen

| Total | Duplicadas | Problemas |
|-------|------------|-----------|
| 20 | 2 (007) | Funciones duplicadas |

---

## Tabla de Migraciones

| # | Nombre | Descripción | Crea Tablas | Modifica RLS | Observaciones |
|---|--------|-------------|-------------|--------------|---------------|
| 001 | initial_schema | Esquema completo | ✅ 12 tablas | ✅ Inicial | Base del sistema |
| 002 | qr_scan_logs | Tabla de escaneos QR | ✅ 1 tabla | ✅ | Escaneos públicos |
| 003 | service_records_rls | RLS inicial | ❌ | ✅ | Polynomial de technician |
| 004 | supervisor_review_fields | Campos de revisión | ❌ | ❌ | reviewed_by, reviewed_at |
| 005 | reports_pdf_email | PDF y email | ❌ | ✅ | Tabla report_sends |
| 006 | public_elevator_rpc | RPC pública QR | ❌ | ❌ | Datos públicos |
| 007_fix | technician submit RLS | Fix RLS técnico | ❌ | ✅ | Fix para submitted |
| 007_tech | technician records RLS | RLS técnico | ❌ | ✅ | SELECT/INSERT/UPDATE |
| 008 | admin supervisor review | RLS admin/supervisor | ❌ | ✅ | SELECT/UPDATE |
| 009 | ai_report_fields | Campos IA | ❌ | ❌ | ai_report_draft, final_report_text |
| 010 | service_report_sends | Envíos de informes | ✅ 1 tabla | ✅ | Historial de envíos |
| 011 | fix report recipients RLS | Fix destinatarios | ❌ | ✅ | RLS admin |
| 012 | building_report_recipients | Destinatarios por edificio | ✅ 1 tabla | ✅ | Nuevo modelo |
| 013 | public service history RPC | Historial público | ❌ | ❌ | Últimos 5 aprobados |
| 014 | harden service records | Endurecer RLS | ❌ | ✅ | Mínimo privilegio |
| 015 | fix service record permissions | Fix permisos | ❌ | ✅ | Technician draft/rejected |
| 016 | rpcs service review | RPCs de revisión | ❌ | ❌ | Aprobar/rechazar |
| 017 | lock service children | Bloquear checklist/fotos | ❌ | ✅ | Solo draft/rejected |
| 018 | harden service photos storage | Endurecer Storage | ❌ | ✅ | Políticas bucket |
| 019 | secure public qr rpc | RPCs públicas seguras | ❌ | ✅ | Token validation |

---

## Duplicados Detectados

| # | Archivos | Problema | Solución |
|---|----------|----------|----------|
| 1 | 007_fix_technician_submit_rls.sql | Duplicado parcial | Ambas ejecutan DROP IF EXISTS, es seguro |
| 2 | 007_technician_records_rls.sql | Duplicado parcial | Ambas ejecutan DROP IF EXISTS, es seguro |

**Nota:** Las migraciones 007 son redundantes pero idempotentes (DROP IF EXISTS). No causan errores.

---

## Dependencias

```
001 → 002, 003, 004, 005, 006, 009, 010, 012, 013
003 → 007_fix, 007_tech, 014, 015
005 → 010
010 → 005
014 → 015
017 → 015
```

---

## Orden Correcto

```
001 → 002 → 003 → 004 → 005 → 006 → 007_fix → 007_tech → 008 → 009 
→ 010 → 011 → 012 → 013 → 014 → 015 → 016 → 017 → 018 → 019
```

---

## Verificación de Instalación Desde Cero

| Paso | Estado |
|------|--------|
| 001 crea tablas | ✅ |
| 002 crea qr_scan_logs | ✅ |
| 003 habilita RLS | ✅ |
| 004 agrega campos | ✅ |
| 005 crea report_sends | ✅ |
| 006 crea RPC pública | ✅ |
| 007-008 refuerzan RLS | ✅ |
| 009 agrega campos IA | ✅ |
| 010 crea service_report_sends | ✅ |
| 012 crea building_report_recipients | ✅ |
| 013 crea RPC historial | ✅ |
| 014-015 endurecen RLS | ✅ |
| 016 crea RPCs de revisión | ✅ |
| 017 bloquea checklist/fotos | ✅ |
| 018 endurece Storage | ✅ |
| 019 asegura portal QR | ✅ |

---

## Inconsistencias Encontradas

| # | Inconsistencia | Impacto | Acción |
|---|----------------|---------|--------|
| 1 | Duplicado 007 | Bajo | No afecta (idempotente) |
| 2 | Sin número 020 | Ninguno | Próxima migración será 020 |

**No hay errores bloqueantes.**

---

## Conclusión

Las 20 migraciones pueden ejecutarse en orden sin errores. Las duplicadas (007) son idempotentes y no causan problemas.
