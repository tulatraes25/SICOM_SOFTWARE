import { useState, useEffect, useRef } from 'react';
import { searchElevators, filterElevators, deactivateElevator, reactivateElevator } from '@/services/elevators.service';
import { listClients } from '@/services/clients.service';
import { createAuditLog } from '@/services/audit.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import ElevatorForm from './ElevatorForm';
import ModalQR from '@/components/qr/ModalQR';
import type { Elevator, Client } from '@/types/database';
import { OPERATIONAL_STATUS_LABELS, CONSERVATION_STATUS_LABELS, CONTRACTUAL_STATUS_LABELS, STATUS_COLORS } from '@/types/elevators';
import { Plus, Search, Edit, PowerOff, RotateCcw, QrCode } from 'lucide-react';

type ActiveFilter = 'active' | 'inactive' | 'all';

function getRelationName(relation: unknown): string {
  if (typeof relation === 'object' && relation !== null && 'name' in relation && typeof (relation as Record<string, unknown>).name === 'string') {
    return (relation as Record<string, string>).name;
  }
  return '-';
}

export default function ElevatorsPage() {
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [filters, setFilters] = useState({ operational_status: '', conservation_status: '', contractual_status: '', client_id: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingElevator, setEditingElevator] = useState<Elevator | null>(null);
  const [qrModal, setQrModal] = useState<Elevator | null>(null);
  const [actionElevatorId, setActionElevatorId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef(false);

  const loadElevators = async () => {
    try {
      setLoading(true);
      setLoadError('');
      let data: Elevator[];
      if (searchQuery) {
        data = await searchElevators(searchQuery, activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined);
      } else {
        data = await filterElevators({ ...filters, active: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined });
      }
      setElevators(data);
    } catch (err) {
      setLoadError('No se pudieron cargar los ascensores.');
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const data = await listClients();
      setClients(data.filter(c => c.active));
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  useEffect(() => { loadClients(); }, []);
  useEffect(() => { loadElevators(); }, [searchQuery, filters, activeFilter]);

  const handleEdit = (elevator: Elevator) => {
    setEditingElevator(elevator);
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDeactivate = async (elevator: Elevator) => {
    if (elevator.responsible_user_id) {
      setActionError('Antes de desactivar este ascensor, retiralo del responsable asignado desde Usuarios → Responsables de edificios.');
      return;
    }
    if (!confirm(`¿Desactivar el ascensor «${elevator.code}»? Permanecerá disponible en el historial y podrá reactivarse posteriormente.`)) return;
    if (actionRef.current) return;
    actionRef.current = true;
    setActionElevatorId(elevator.id);
    setActionError('');
    try {
      await deactivateElevator(elevator.id);
      await createAuditLog({ action: 'deactivate', entity_type: 'elevator', entity_id: elevator.id });
      setSuccess(`El ascensor ${elevator.code} fue desactivado correctamente.`);
      loadElevators();
    } catch (err) {
      setActionError('No se pudo desactivar el ascensor.');
    } finally {
      actionRef.current = false;
      setActionElevatorId(null);
    }
  };

  const handleReactivate = async (elevator: Elevator) => {
    if (!confirm(`¿Reactivar el ascensor «${elevator.code}»?`)) return;
    if (actionRef.current) return;
    actionRef.current = true;
    setActionElevatorId(elevator.id);
    setActionError('');
    try {
      await reactivateElevator(elevator.id);
      await createAuditLog({ action: 'reactivate', entity_type: 'elevator', entity_id: elevator.id });
      setSuccess(`El ascensor ${elevator.code} fue reactivado correctamente.`);
      loadElevators();
    } catch (err) {
      setActionError('No se pudo reactivar el ascensor.');
    } finally {
      actionRef.current = false;
      setActionElevatorId(null);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingElevator(null);
    loadElevators();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingElevator(null);
  };

  const emptyMessage = searchQuery
    ? 'No se encontraron ascensores para la búsqueda.'
    : activeFilter === 'active'
      ? 'No hay ascensores activos.'
      : activeFilter === 'inactive'
        ? 'No hay ascensores inactivos.'
        : 'No se encontraron ascensores.';

  return (
    <DashboardLayout role="admin" title="Ascensores">
      <div className="space-y-4 2xl:space-y-6">
        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 2xl:gap-4">
          <div className="flex-1 flex flex-col gap-3 2xl:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por código, fabricante o serie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="w-44">
                <Select label="Vigencia" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
                  options={[{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }, { value: 'all', label: 'Todos' }]} />
              </div>
              <div className="w-44">
                <Select label="Cliente" value={filters.client_id} onChange={(e) => setFilters({ ...filters, client_id: e.target.value })}
                  options={[{ value: '', label: 'Todos los clientes' }, ...clients.map(c => ({ value: c.id, label: c.name }))]} />
              </div>
              <div className="w-44">
                <Select label="Estado operativo" value={filters.operational_status} onChange={(e) => setFilters({ ...filters, operational_status: e.target.value })}
                  options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(OPERATIONAL_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
              </div>
              <div className="w-44">
                <Select label="Conservación" value={filters.conservation_status} onChange={(e) => setFilters({ ...filters, conservation_status: e.target.value })}
                  options={[{ value: '', label: 'Todas las conservaciones' }, ...Object.entries(CONSERVATION_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
              </div>
              <div className="w-44">
                <Select label="Contractual" value={filters.contractual_status} onChange={(e) => setFilters({ ...filters, contractual_status: e.target.value })}
                  options={[{ value: '', label: 'Todos los contractuales' }, ...Object.entries(CONTRACTUAL_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]} />
              </div>
            </div>
          </div>
          <Button onClick={() => { setEditingElevator(null); setShowForm(true); }}><Plus size={18} className="mr-2" /> Nuevo Ascensor</Button>
        </div>

        {loadError && (
          <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center justify-between">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={loadElevators}>Reintentar</Button>
          </div>
        )}

        {actionError && (
          <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
            {actionError}
          </div>
        )}

        {success && (
          <div role="status" className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm">
            {success}
          </div>
        )}

        {/* Form */}
        <div ref={formRef}>
          {showForm && (
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold mb-4">{editingElevator ? 'Editar Ascensor' : 'Nuevo Ascensor'}</h3>
                <ElevatorForm elevator={editingElevator} onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* QR Modal */}
        {qrModal && <ModalQR elevatorCode={qrModal.code} qrToken={qrModal.qr_token} onClose={() => setQrModal(null)} />}

        {/* List */}
        <Card>
          <CardContent>
            {loading ? (
              <div className="text-center py-8"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : elevators.length === 0 ? (
              <div className="text-center py-8"><p className="text-gray-500">{emptyMessage}</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Cliente</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Edificio</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Estado</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Vigencia</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elevators.map((elevator) => (
                      <tr key={elevator.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono font-medium">{elevator.code}</td>
                        <td className="py-3 px-4 text-gray-600">{getRelationName(elevator.client)}</td>
                        <td className="py-3 px-4 text-gray-600">{getRelationName(elevator.building)}</td>
                        <td className="py-3 px-4"><Badge className={STATUS_COLORS[elevator.operational_status] || ''}>{OPERATIONAL_STATUS_LABELS[elevator.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || elevator.operational_status}</Badge></td>
                        <td className="py-3 px-4">
                          <Badge variant={elevator.active ? 'success' : 'danger'}>{elevator.active ? 'Activo' : 'Inactivo'}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setQrModal(elevator)} title="Ver QR" type="button"><QrCode size={16} /></Button>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(elevator)} title="Editar" type="button"><Edit size={16} /></Button>
                            {elevator.active ? (
                              <Button size="sm" variant="ghost" onClick={() => handleDeactivate(elevator)} title={`Desactivar ascensor ${elevator.code}`} type="button" disabled={actionElevatorId === elevator.id} className="text-danger hover:text-danger"><PowerOff size={16} /></Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => handleReactivate(elevator)} title={`Reactivar ascensor ${elevator.code}`} type="button" disabled={actionElevatorId === elevator.id} className="text-success hover:text-success"><RotateCcw size={16} /></Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
