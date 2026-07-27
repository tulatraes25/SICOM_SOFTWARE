import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

import { supabase } from '@/config/supabase';
import { Eye, Clock } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', submitted: 'info', approved: 'success', cancelled: 'danger', rectified: 'warning',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', submitted: 'Enviado', approved: 'Aprobado', cancelled: 'Anulado', rectified: 'Rectificado',
};

export default function TechVisitsPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); }); }, []);
  useEffect(() => { if (userId) loadEntries(); }, [userId]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('elevator_visit_entries')
        .select('*, elevator:elevators(code, building:buildings(name)), technician:profiles!elevator_visit_entries_technician_id_fkey(full_name)')
        .eq('technician_id', userId)
        .order('visit_date', { ascending: false })
        .order('entry_number', { ascending: false });
      setEntries(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const assigned = entries.filter(e => ['submitted', 'draft'].includes(e.status));
  const approved = entries.filter(e => e.status === 'approved');

  return (
    <DashboardLayout role="technician" title="Mis Visitas">
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{assigned.length}</p>
            <p className="text-xs text-blue-600">Pendientes</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{approved.length}</p>
            <p className="text-xs text-green-600">Aprobadas</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{entries.length}</p>
            <p className="text-xs text-gray-600">Total</p>
          </div>
        </div>

        {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
        : entries.length === 0 ? <div className="text-center py-12"><Clock size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No tenés visitas registradas</p></div>
        : <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200 bg-gray-50">
          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">N.º</th>
          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ascensor</th>
          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Edificio</th>
          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
          <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
        </tr></thead><tbody>
          {entries.map((e) => <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-4 py-3 font-mono font-semibold">N.º {e.entry_number}</td>
            <td className="px-4 py-3 text-sm">{new Date(e.visit_date).toLocaleDateString('es-AR')}</td>
            <td className="px-4 py-3 text-sm font-mono">{(e.elevator as any)?.code || '-'}</td>
            <td className="px-4 py-3 text-sm text-gray-600">{(e.elevator as any)?.building?.name || '-'}</td>
            <td className="px-4 py-3"><Badge variant={STATUS_BADGE[e.status]}>{STATUS_LABELS[e.status]}</Badge></td>
            <td className="px-4 py-3"><Link to={`/admin/ascensores/${e.elevator_id}/libro/${e.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link></td>
          </tr>)}
        </tbody></table></div></CardContent></Card>}
      </div>
    </DashboardLayout>
  );
}
