import { useState, useEffect } from 'react';
import { listClients, searchClients, deactivateClient, activateClient } from '@/services/clients.service';
import { createAuditLog } from '@/services/audit.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ClientForm from './ClientForm';
import type { Client } from '@/types/database';
import { Plus, Search, Edit, Building2 } from 'lucide-react';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = searchQuery
        ? await searchClients(searchQuery)
        : await listClients();
      setClients(data);
    } catch (err) {
      console.error('Error loading clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [searchQuery]);

  const handleDeactivate = async (client: Client) => {
    if (!confirm(`¿Desactivar cliente "${client.name}"?`)) return;
    try {
      await deactivateClient(client.id);
      await createAuditLog({
        action: 'deactivate',
        entity_type: 'client',
        entity_id: client.id,
      });
      loadClients();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleActivate = async (client: Client) => {
    try {
      await activateClient(client.id);
      await createAuditLog({
        action: 'activate',
        entity_type: 'client',
        entity_id: client.id,
      });
      loadClients();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingClient(null);
    loadClients();
  };

  return (
    <DashboardLayout role="admin" title="Clientes">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre, CUIT o localidad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={18} className="mr-2" />
            Nuevo Cliente
          </Button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold mb-4">
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <ClientForm
                client={editingClient}
                onSuccess={handleFormSuccess}
                onCancel={() => { setShowForm(false); setEditingClient(null); }}
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
                <p className="text-gray-500">Cargando clientes...</p>
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8">
                <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No se encontraron clientes</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Nombre</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">CUIT</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Localidad</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Contacto</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Estado</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-sm">{client.code}</td>
                        <td className="py-3 px-4 font-medium">{client.name}</td>
                        <td className="py-3 px-4 text-gray-600">{client.tax_id || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{client.locality || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{client.contact_name || '-'}</td>
                        <td className="py-3 px-4">
                          <Badge variant={client.active ? 'success' : 'danger'}>
                            {client.active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setEditingClient(client); setShowForm(true); }}
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              size="sm"
                              variant={client.active ? 'danger' : 'secondary'}
                              onClick={() => client.active ? handleDeactivate(client) : handleActivate(client)}
                            >
                              {client.active ? 'Desactivar' : 'Activar'}
                            </Button>
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
