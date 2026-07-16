import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { listClaims } from '@/services/claims.service';
import { CLAIM_STATUS_LABELS, CLAIM_PRIORITY_LABELS } from '@/types/database';
import type { Claim } from '@/types/database';
import { Eye, AlertTriangle } from 'lucide-react';
import { supabase } from '@/config/supabase';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  open: 'info', assigned: 'warning', in_progress: 'warning', visited: 'info',
  resolved: 'success', closed: 'default', cancelled: 'danger',
};
const PRIORITY_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  low: 'default', normal: 'info', high: 'warning', urgent: 'danger',
};

export default function TechClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); });
  }, []);

  useEffect(() => { if (userId) loadClaims(); }, [userId]);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const result = await listClaims({ assigned_to: userId });
      setClaims(result.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

  return (
    <DashboardLayout role="technician" title="Mis Reclamos">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Mis Reclamos Asignados</h2>
        <Card><CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
          : claims.length === 0 ? <div className="text-center py-12"><AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No tenés reclamos asignados</p></div>
          : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">N.º</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Prioridad</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cliente</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ascensor</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asunto</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Días</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
          </tr></thead><tbody>
            {claims.map((c) => <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono font-semibold text-gray-900">{c.service_case ? `${(c.service_case as any).numbering_mode === 'test' ? 'PRUEBA ' : ''}N.º ${(c.service_case as any).case_number}` : '-'}</td>
              <td className="px-4 py-3"><Badge variant={PRIORITY_BADGE[c.priority]}>{CLAIM_PRIORITY_LABELS[c.priority]}</Badge></td>
              <td className="px-4 py-3 text-sm text-gray-600">{(c.client as any)?.name || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{(c.elevator as any)?.code || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">{c.subject}</td>
              <td className="px-4 py-3"><Badge variant={STATUS_BADGE[c.status]}>{CLAIM_STATUS_LABELS[c.status]}</Badge></td>
              <td className="px-4 py-3 text-sm text-gray-500">{daysSince(c.claim_date)}d</td>
              <td className="px-4 py-3"><Link to={`/tecnico/reclamos/${c.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link></td>
            </tr>)}
          </tbody></table></div>}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
