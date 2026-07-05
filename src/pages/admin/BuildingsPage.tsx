import { useState, useEffect } from 'react';
import { listBuildings, searchBuildings, deactivateBuilding } from '@/services/buildings.service';
import { listClients } from '@/services/clients.service';
import { createAuditLog } from '@/services/audit.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import BuildingForm from './BuildingForm';
import type { Building, Client } from '@/types/database';
import { Plus, Search, Edit, Building2 } from 'lucide-react';

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);

  const loadBuildings = async () => {
    try {
      setLoading(true);
      let data: Building[];
      if (searchQuery) {
        data = await searchBuildings(searchQuery);
      } else {
        data = await listBuildings();
      }
      if (filterClient) {
        data = data.filter(b => b.client_id === filterClient);
      }
      setBuildings(data);
    } catch (err) {
      console.error('Error loading buildings:', err);
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
    loadBuildings();
  }, [searchQuery, filterClient]);

  const handleDeactivate = async (building: Building) => {
    if (!confirm(`¿Desactivar edificio "${building.name}"?`)) return;
    try {
      await deactivateBuilding(building.id);
      await createAuditLog({
        action: 'deactivate',
        entity_type: 'building',
        entity_id: building.id,
      });
      loadBuildings();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingBuilding(null);
    loadBuildings();
  };

  const getClientName = (building: Building) => {
    const client = building.client as unknown as Client;
    return client?.name || '-';
  };

  return (
    <DashboardLayout role="admin" title="Edificios">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex-1 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por nombre, dirección o localidad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="w-48">
              <Select
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                options={[
                  { value: '', label: 'Todos los clientes' },
                  ...clients.map(c => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={18} className="mr-2" />
            Nuevo Edificio
          </Button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold mb-4">
                {editingBuilding ? 'Editar Edificio' : 'Nuevo Edificio'}
              </h3>
              <BuildingForm
                building={editingBuilding}
                onSuccess={handleFormSuccess}
                onCancel={() => { setShowForm(false); setEditingBuilding(null); }}
              />
            </CardContent>
          </Card>
        )}

        {/* List */}
        <Card>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Cargando edificios...</p>
              </div>
            ) : buildings.length === 0 ? (
              <div className="text-center py-8">
                <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No se encontraron edificios</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Nombre</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Cliente</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Dirección</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Localidad</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Estado</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildings.map((building) => (
                      <tr key={building.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-sm">{building.code}</td>
                        <td className="py-3 px-4 font-medium">{building.name}</td>
                        <td className="py-3 px-4 text-gray-600">{getClientName(building)}</td>
                        <td className="py-3 px-4 text-gray-600">{building.address}</td>
                        <td className="py-3 px-4 text-gray-600">{building.locality}</td>
                        <td className="py-3 px-4">
                          <Badge variant={building.active ? 'success' : 'danger'}>
                            {building.active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setEditingBuilding(building); setShowForm(true); }}
                            >
                              <Edit size={16} />
                            </Button>
                            {building.active && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleDeactivate(building)}
                              >
                                Desactivar
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
