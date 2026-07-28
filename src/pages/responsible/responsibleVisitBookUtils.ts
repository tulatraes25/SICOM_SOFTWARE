import type { ResponsibleVisitEntry, ResponsibleElevator, ResponsibleTechnician, ResponsibleServiceRecord, ResponsibleServiceOrder } from '@/services/responsiblePortalService';
import type { VisitBookEntryData } from '@/components/pdf/VisitBookPDF';

const naturalSort = new Intl.Collator('es', { numeric: true, sensitivity: 'base' }).compare;

export function sortResponsibleVisitEntries(
  entries: ResponsibleVisitEntry[],
  elevMap: Map<string, ResponsibleElevator>,
  scope: 'elevator' | 'building',
): ResponsibleVisitEntry[] {
  return [...entries].sort((a, b) => {
    const dateCmp = a.visit_date.localeCompare(b.visit_date);
    if (dateCmp !== 0) return dateCmp;
    if (scope === 'building') {
      const aCode = elevMap.get(a.elevator_id)?.code || '';
      const bCode = elevMap.get(b.elevator_id)?.code || '';
      const codeCmp = naturalSort(aCode, bCode);
      if (codeCmp !== 0) return codeCmp;
    }
    return a.entry_number - b.entry_number;
  });
}

export function buildResponsibleVisitBookEntries(
  visitEntries: ResponsibleVisitEntry[],
  elevMap: Map<string, ResponsibleElevator>,
  techMap: Map<string, ResponsibleTechnician>,
  srMap: Map<string, ResponsibleServiceRecord>,
  soMap: Map<string, ResponsibleServiceOrder>,
): VisitBookEntryData[] {
  return visitEntries.map((v) => {
    const elevator = elevMap.get(v.elevator_id);
    if (!elevator) throw new Error(`No se pudo identificar el ascensor del asiento N.º ${v.entry_number}`);
    return {
      id: v.id,
      entry_number: v.entry_number,
      visit_date: v.visit_date,
      origin_type: v.origin_type ?? undefined,
      title: v.title ?? undefined,
      description: v.description,
      work_performed: v.work_performed ?? undefined,
      observations: v.observations ?? undefined,
      status: v.status,
      check_in_at: v.check_in_at ?? undefined,
      check_out_at: v.check_out_at ?? undefined,
      duration_minutes: v.duration_minutes ?? undefined,
      duration_seconds: v.duration_seconds ?? undefined,
      service_order_id: v.service_order_id ?? undefined,
      service_record_id: v.service_record_id ?? undefined,
      elevator: { id: elevator.id, code: elevator.code },
      technician: v.technician_id
        ? { id: v.technician_id, full_name: techMap.get(v.technician_id)?.full_name }
        : undefined,
      service_case: v.service_case_id
        ? { id: v.service_case_id, case_number: v.case_number ?? null, numbering_mode: v.numbering_mode ?? null }
        : undefined,
      _serviceRecord: v.service_record_id ? srMap.get(v.service_record_id) || null : null,
      _serviceOrder: v.service_order_id ? soMap.get(v.service_order_id) || null : null,
    };
  });
}
