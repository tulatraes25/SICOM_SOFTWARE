import { useState, useEffect } from 'react';
import { listElevators, searchElevators, filterElevators, deactivateElevator } from '@/services/elevators.service';
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
import {
  OPERATIONAL_STATUS_LABELS,
  CONSERVATION_STATUS_LABELS,
  CONTRACTUAL_STATUS_LABELS,
  STATUS_COLORS,
} from '@/types/elevators';
import { Plus, Search, Edit, Trash2, QrCode } from 'lucide-react';

export default function ElevatorsPage() {
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    operational_status: '',
    conservation_status: '',
    contractual_status: '',
    client_id: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [editingElevator, setEditingElevator] = useState<Elevator | null>(null);
  const [qrModal, setQrModal] = useState<Elevator | null>(null);

  const loadElevators = async () => {
    try {
      setLoading(true);
      let data: Elevator[];

      if (searchQuery) {
        data = await searchElevators(searchQuery);
      } else if (Object.values(filters).some(v => v)) {
        data = await filterElevators(filters);
      } else {
        data = await listElevators();
      }

      setElevators(data);
    } catch (err) {
      console.error('Error loading elevators:', err);
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

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    loadElevators();
  }, [searchQuery, filters]);

  const handleDeactivate = async (elevator: Elevator) => {
    if (!confirm(`¿Desactivar ascensor "${elevator.code}"?`)) return;
    try {
      await deactivateElevator(elevator.id);
      await createAuditLog({
        action: 'deactivate',
        entity_type: 'elevator',
        entity_id: elevator.id,
      });
      loadElevators();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingElevator(null);
    loadElevators();
  };

  const getClientName = (elevator: Elevator) => {
    const client = elevator.client as unknown as Client;
    return client?.name || '-';
  };

  const getBuildingName = (elevator: Elevator) => {
    const building = elevator.building as unknown as { name: string };
    return building?.name || '-';
  };

  return (
    <DashboardLayout role="admin" title="Ascensores">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por código, fabricante o número de serie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="w-44">
                <Select
                  value={filters.client_id}
                  onChange={(e) => setFilters({ ...filters, client_id: e.target.value })}
                  options={[
                    { value: '', label: 'Todos los clientes' },
                    ...clients.map(c => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>
              <div className="w-44">
                <Select
                  value={filters.operational_status}
                  onChange={(e) => setFilters({ ...filters, operational_status: e.target.value })}
                  options={[
                    { value: '', label: 'Todos los estados' },
                    ...Object.entries(OPERATIONAL_STATUS_LABELS).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
              <div className="w-44">
                <Select
                  value={filters.conservation_status}
                  onChange={(e) => setFilters({ ...filters, conservation_status: e.target.value })}
                  options={[
                    { value: '', label: 'Todas las conservaciones' },
                    ...Object.entries(CONSERVATION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
              <div className="w-44">
                <Select
                  value={filters.contractual_status}
                  onChange={(e) => setFilters({ ...filters, contractual_status: e.target.value })}
                  options={[
                    { value: '', label: 'Todos los contractuales' },
                    ...Object.entries(CONTRACTUAL_STATUS_LABELS).map(([value, label]) => ({ value, label })),
                  ]}
                />
              </div>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={18} className="mr-2" />
            Nuevo Ascensor
          </Button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold mb-4">
                {editingElevator ? 'Editar Ascensor' : 'Nuevo Ascensor'}
              </h3>
              <ElevatorForm
                elevator={editingElevator}
                onSuccess={handleFormSuccess}
                onCancel={() => { setShowForm(false); setEditingElevator(null); }}
              />
            </CardContent>
          </Card>
        )}

        {/* QR Modal */}
        {qrModal && (
          <ModalQR
            elevatorCode={qrModal.code}
            qrToken={qrModal.qr_token}
            onClose={() => setQrModal(null)}
          />
        )}

        {/* List */}
        <Card>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Cargando ascensores...</p>
              </div>
            ) : elevators.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No se encontraron ascensores</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Cliente</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Edificio</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Tipo</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Estado</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Conservación</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Contractual</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elevators.map((elevator) => (
                      <tr key={elevator.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-sm font-medium">{elevator.code}</td>
                        <td className="py-3 px-4 text-gray-600">{getClientName(elevator)}</td>
                        <td className="py-3 px-4 text-gray-600">{getBuildingName(elevator)}</td>
                        <td className="py-3 px-4 text-gray-600 capitalize">{elevator.elevator_type || '-'}</td>
                        <td className="py-3 px-4">
                          <Badge className={STATUS_COLORS[elevator.operational_status] || ''}>
                            {OPERATIONAL_STATUS_LABELS[elevator.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || elevator.operational_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={STATUS_COLORS[elevator.conservation_status] || ''}>
                            {CONSERVATION_STATUS_LABELS[elevator.conservation_status as keyof typeof CONSERVATION_STATUS_LABELS] || elevator.conservation_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={STATUS_COLORS[elevator.contractual_status] || ''}>
                            {CONTRACTUAL_STATUS_LABELS[elevator.contractual_status as keyof typeof CONTRACTUAL_STATUS_LABELS] || elevator.contractual_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setQrModal(elevator)}
                              title="Ver QR"
                            >
                              <QrCode size={16} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setEditingElevator(elevator); setShowForm(true); }}
                              title="Editar"
                            >
                              <Edit size={16} />
                            </Button>
                            {elevator.active && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeactivate(elevator)}
                                title="Desactivar"
                                className="text-danger hover:text-danger"
                              >
                                <Trash2 size={16} />
                              </Button>
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
