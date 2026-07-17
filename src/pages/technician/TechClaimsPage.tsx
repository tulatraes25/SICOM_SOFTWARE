import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { listClaims, startWork } from '@/services/claims.service';
import { CLAIM_PRIORITY_LABELS } from '@/types/database';
import type { Claim } from '@/types/database';
import { Eye, Play, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/config/supabase';

const PRIORITY_STYLE: Record<string, { bg: string; border: string; text: string; badge: 'danger' | 'warning' | 'info' | 'default' }> = {
  urgent: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', badge: 'danger' },
  high: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', badge: 'warning' },
  normal: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'info' },
  low: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', badge: 'default' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Recién asignado';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h ${mins % 60} min`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Ayer' : `Hace ${days} días`;
}

function isDelayed(claim: Claim): string | null {
  if (claim.status !== 'assigned' && claim.status !== 'in_progress') return null;
  const diff = Date.now() - new Date(claim.received_at).getTime();
  const mins = Math.floor(diff / 60000);
  if (claim.priority === 'urgent' && mins > 30 && claim.status === 'assigned') return 'Requiere atención';
  if (claim.priority === 'high' && mins > 120 && claim.status === 'assigned') return 'Demorado';
  if (claim.priority === 'urgent' && mins > 60 && claim.status === 'in_progress') return 'Verificar urgencia';
  return null;
}

export default function TechClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); }); }, []);
  useEffect(() => { if (userId) loadClaims(); }, [userId]);

  const loadClaims = async () => {
    setLoading(true);
    try { const result = await listClaims({ assigned_to: userId }); setClaims(result.data); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleStartWork = async (claimId: string) => {
    setActionLoading(claimId);
    try { await startWork(claimId); await loadClaims(); }
    catch (err: any) { alert(err?.message || 'Error'); } finally { setActionLoading(null); }
  };

  const assigned = claims.filter(c => c.status === 'assigned');
  const inProgress = claims.filter(c => c.status === 'in_progress');
  const visited = claims.filter(c => c.status === 'visited');
  const urgentHigh = claims.filter(c => c.priority === 'urgent' || c.priority === 'high');
  const pending = assigned.length + inProgress.length + visited.length;

  const renderCard = (claim: Claim) => {
    const p = PRIORITY_STYLE[claim.priority] || PRIORITY_STYLE.normal;
    const delay = isDelayed(claim);
    const caseNum = (claim.service_case as any)?.case_number;
    const caseMode = (claim.service_case as any)?.numbering_mode;
    const numLabel = caseMode === 'test' ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;

    return (
      <div key={claim.id} className={`rounded-lg border-2 ${p.border} ${p.bg} p-4`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            {claim.status === 'assigned' && <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded mr-2">NUEVO</span>}
            <span className="font-mono font-bold text-gray-900">{numLabel}</span>
          </div>
          <Badge variant={p.badge}>{CLAIM_PRIORITY_LABELS[claim.priority]}</Badge>
        </div>
        <p className="text-sm font-medium text-gray-900 mb-1">{(claim.building as any)?.name || 'Sin edificio'}</p>
        <p className="text-xs text-gray-500 mb-1">{(claim.elevator as any)?.code ? `Ascensor ${(claim.elevator as any).code}` : ''}</p>
        <p className="text-sm text-gray-700 mb-2">{claim.subject}</p>
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1"><Clock size={12} /> {timeAgo(claim.received_at)}</span>
          {delay && <span className={`font-medium ${p.text}`}>{delay}</span>}
        </div>
        <div className="flex gap-2">
          {claim.status === 'assigned' && (
            <Button size="sm" onClick={() => handleStartWork(claim.id)} disabled={actionLoading === claim.id}>
              <Play size={14} className="mr-1" /> Comenzar atención
            </Button>
          )}
          {claim.status === 'in_progress' && (
            <Link to={`/tecnico/reclamos/${claim.id}`}>
              <Button size="sm"><Play size={14} className="mr-1" /> Continuar atención</Button>
            </Link>
          )}
          {claim.status === 'visited' && (
            <Link to={`/tecnico/reclamos/${claim.id}`}>
              <Button size="sm"><CheckCircle size={14} className="mr-1" /> Completar resolución</Button>
            </Link>
          )}
          <Link to={`/tecnico/reclamos/${claim.id}`}>
            <Button size="sm" variant="outline"><Eye size={14} className="mr-1" /> Ver detalle</Button>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout role="technician" title="Mis Reclamos">
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{assigned.length}</p>
            <p className="text-xs text-blue-600">Nuevos</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-700">{inProgress.length}</p>
            <p className="text-xs text-yellow-600">En atención</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{urgentHigh.length}</p>
            <p className="text-xs text-red-600">Urgentes / Alta</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{pending}</p>
            <p className="text-xs text-gray-600">Pendientes</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
        ) : pending === 0 ? (
          <div className="text-center py-12">
            <CheckCircle size={48} className="mx-auto text-success mb-4" />
            <p className="text-lg font-medium text-gray-900">No tenés reclamos pendientes</p>
            <p className="text-sm text-gray-500">Las nuevas asignaciones aparecerán aquí.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {assigned.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-3">Nuevos Reclamos ({assigned.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {assigned.map(c => renderCard(c))}
                </div>
              </div>
            )}
            {inProgress.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-yellow-700 uppercase tracking-wide mb-3">En Atención ({inProgress.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {inProgress.map(c => renderCard(c))}
                </div>
              </div>
            )}
            {visited.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wide mb-3">Pendientes de Resolver ({visited.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visited.map(c => renderCard(c))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
