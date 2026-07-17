import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { listUsers } from '@/services/adminUsers.service';
import type { AdminUser } from '@/services/adminUsers.service';
import { Plus, Search, Eye, Users } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = { admin: 'Administrador', supervisor: 'Supervisor', technician: 'Técnico', responsible: 'Responsable' };
const ROLE_BADGE: Record<string, 'default' | 'success' | 'warning' | 'info' | 'danger'> = { admin: 'danger', supervisor: 'warning', technician: 'info', responsible: 'default' };
const ROLE_OPTIONS = [{ value: '', label: 'Todos' }, ...Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))];

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const filtered = users.filter(u => {
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole && u.role !== filterRole) return false;
    return true;
  });

  return (
    <DashboardLayout role="admin" title="Usuarios">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-gray-900">Usuarios</h2><p className="text-gray-500">{users.length} usuario(s)</p></div>
          <Link to="/admin/usuarios/nuevo"><Button><Plus size={16} className="mr-2" /> Nuevo Usuario</Button></Link>
        </div>
        <Card><CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="Buscar por nombre o email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
            <Select options={ROLE_OPTIONS} value={filterRole} onChange={(e) => setFilterRole(e.target.value)} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
          : filtered.length === 0 ? <div className="text-center py-12"><Users size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No se encontraron usuarios</p></div>
          : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Rol</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Creado</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
          </tr></thead><tbody>
            {filtered.map((u) => <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{u.full_name || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
              <td className="px-4 py-3"><Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABELS[u.role] || u.role}</Badge></td>
              <td className="px-4 py-3"><Badge variant={u.active ? 'success' : 'danger'}>{u.active ? 'Activo' : 'Inactivo'}</Badge></td>
              <td className="px-4 py-3 text-sm text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleDateString('es-AR') : '-'}</td>
              <td className="px-4 py-3"><Link to={`/admin/usuarios/${u.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link></td>
            </tr>)}
          </tbody></table></div>}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
