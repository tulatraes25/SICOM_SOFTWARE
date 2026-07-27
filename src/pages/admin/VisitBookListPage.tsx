import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';

import { FileText, Eye } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', submitted: 'info', approved: 'success', cancelled: 'danger', rectified: 'warning',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', submitted: 'Enviado', approved: 'Aprobado', cancelled: 'Anulado', rectified: 'Rectificado',
};

export default function VisitBookListPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadEntries(); }, [search]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      // Simple query first to verify data exists
      let query = supabase.from('elevator_visit_entries')
        .select('id, entry_number, visit_date, elevator_id, technician_id, status, service_order_id, service_record_id')
        .order('visit_date', { ascending: false })
        .order('entry_number', { ascending: false });
      const { data, error } = await query;
      if (error) {
        console.error('[VisitBook] Query error:', error);
        setEntries([]);
      } else {
        // Load related data separately if needed
        const enriched = await Promise.all((data || []).map(async (entry: any) => {
          let elevator = null, technician = null;
          if (entry.elevator_id) {
            const { data: e } = await supabase.from('elevators').select('id, code, building:buildings(name)').eq('id', entry.elevator_id).single();
            elevator = e;
          }
          if (entry.technician_id) {
            const { data: t } = await supabase.from('profiles').select('full_name').eq('id', entry.technician_id).single();
            technician = t;
          }
          return { ...entry, elevator, technician };
        }));
        setEntries(enriched);
      }
    } catch (err) { console.error('[VisitBook] Error:', err); } finally { setLoading(false); }
  };

  return (
    <DashboardLayout role="admin" title="Libro de Visitas">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Libro Digital de Visitas</h2>
          <Input placeholder="Buscar por ascensor o edificio..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        </div>
        <Card><CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
          : entries.length === 0 ? <div className="text-center py-12"><FileText size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No hay visitas registradas</p></div>
          : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asiento</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ascensor</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Edificio</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Técnico</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
          </tr></thead><tbody>
            {entries.map((e) => <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono font-semibold">N.º {e.entry_number}</td>
              <td className="px-4 py-3 text-sm">{new Date(e.visit_date).toLocaleDateString('es-AR')}</td>
              <td className="px-4 py-3 text-sm font-mono">{(e.elevator as any)?.code || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{(e.elevator as any)?.building?.name || '-'}</td>
              <td className="px-4 py-3 text-sm">{(e.technician as any)?.full_name || '-'}</td>
              <td className="px-4 py-3"><Badge variant={STATUS_BADGE[e.status]}>{STATUS_LABELS[e.status]}</Badge></td>
              <td className="px-4 py-3"><Link to={`/admin/libro-visitas/${e.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link></td>
            </tr>)}
          </tbody></table></div>}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
