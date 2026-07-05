import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchElevatorsForTechnician } from '@/services/serviceRecords.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { OPERATIONAL_STATUS_LABELS, STATUS_COLORS } from '@/types/elevators';
import { Search, Plus, Building2, MapPin } from 'lucide-react';

export default function TechnicianElevatorSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const data = await searchElevatorsForTechnician(query);
      setResults(data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="technician" title="Buscar Ascensor">
      <div className="space-y-6">
        {/* Search */}
        <Card>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por código, dirección o localidad..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <Button type="submit" loading={loading}>
                Buscar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Buscando...</p>
          </div>
        ) : searched && results.length === 0 ? (
          <Card>
            <CardContent>
              <div className="text-center py-8">
                <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No se encontraron ascensores</p>
              </div>
            </CardContent>
          </Card>
        ) : results.length > 0 ? (
          <div className="space-y-3">
            {results.map((elevator) => (
              <Card key={elevator.id}>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-mono font-bold text-lg">{elevator.code}</h3>
                        <Badge className={STATUS_COLORS[elevator.operational_status] || ''}>
                          {OPERATIONAL_STATUS_LABELS[elevator.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || elevator.operational_status}
                        </Badge>
                      </div>
                      
                      {elevator.building && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building2 size={14} />
                          <span>{elevator.building.name}</span>
                        </div>
                      )}
                      
                      {elevator.building?.locality && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <MapPin size={14} />
                          <span>{elevator.building.locality}</span>
                        </div>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => navigate(`/tecnico/ascensores/${elevator.id}/mantenimiento/nuevo`)}
                    >
                      <Plus size={16} className="mr-2" />
                      Cargar Mantenimiento
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
