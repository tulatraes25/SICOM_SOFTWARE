import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { listUsers, getAdminUsersErrorMessage } from '@/services/adminUsers.service';
import type { AdminUser, AdminUserRole } from '@/services/adminUsers.service';
import { Plus, Search, Eye, Users, RefreshCw } from 'lucide-react';

const ROLE_LABELS: Record<AdminUserRole, string> = { admin: 'Administrador', supervisor: 'Supervisor', technician: 'Técnico', responsible: 'Responsable' };
const ROLE_BADGE: Record<AdminUserRole, 'default' | 'success' | 'warning' | 'info' | 'danger'> = { admin: 'danger', supervisor: 'warning', technician: 'info', responsible: 'default' };
const STAFF_ROLE_OPTIONS = [{ value: '', label: 'Todos' }, { value: 'admin', label: 'Administrador' }, { value: 'supervisor', label: 'Supervisor' }, { value: 'technician', label: 'Técnico' }];
const VALID_FILTER_ROLES = ['', 'admin', 'supervisor', 'technician'];
const naturalSort = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-AR');
}

function userLabel(u: AdminUser): string { return u.full_name || u.email; }

function passwordStatus(u: AdminUser): { label: string; variant: 'default' | 'success' | 'warning' } {
  if (u.role !== 'responsible') return { label: 'No aplica', variant: 'default' };
  if (u.must_change_password) return { label: 'Cambio pendiente', variant: 'warning' };
  if (u.password_changed_at) return { label: 'Actualizada', variant: 'success' };
  return { label: 'Sin cambio pendiente', variant: 'default' };
}

type Tab = 'usuarios' | 'responsables';
const TAB_ACTIVE = 'border-b-2 border-primary text-primary font-semibold';
const TAB_INACTIVE = 'border-b-2 border-gray-300 text-gray-500 hover:text-gray-700';

export default function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: Tab = searchParams.get('tab') === 'responsables' ? 'responsables' : 'usuarios';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const loadingRef = useRef(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
      setError('');
    } catch (err) {
      setUsers([]);
      setError(getAdminUsersErrorMessage(err));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const switchTab = (tab: Tab) => {
    setSearchParams({ tab }, { replace: true });
    setSearch('');
    setFilterRole('');
  };

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const an = a.full_name || '';
      const bn = b.full_name || '';
      const aHas = an ? 0 : 1;
      const bHas = bn ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      const nc = naturalSort.compare(an, bn);
      if (nc !== 0) return nc;
      const ec = naturalSort.compare(a.email, b.email);
      if (ec !== 0) return ec;
      return naturalSort.compare(a.id, b.id);
    });
  }, [users]);

  const tabUsers = useMemo(() => sortedUsers.filter((u) => u.role !== 'responsible'), [sortedUsers]);
  const tabResponsibles = useMemo(() => sortedUsers.filter((u) => u.role === 'responsible'), [sortedUsers]);
  const displayedUsers = activeTab === 'usuarios' ? tabUsers : tabResponsibles;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return displayedUsers.filter((u) => {
      if (q && !u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (activeTab === 'usuarios' && filterRole && u.role !== filterRole) return false;
      return true;
    });
  }, [displayedUsers, search, filterRole, activeTab]);

  const hasFilters = search.trim() !== '' || (activeTab === 'usuarios' && filterRole !== '');
  const tabCount = displayedUsers.length;
  const filteredCount = filtered.length;
  const isStaff = activeTab === 'usuarios';

  const handleRoleFilter = (value: string) => {
    if ((VALID_FILTER_ROLES as string[]).includes(value)) setFilterRole(value);
  };

  const staffHeaders = (
    <tr className="border-b border-gray-200 bg-gray-50">
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Rol</th>
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Contraseña</th>
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Creado</th>
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
    </tr>
  );

  const respHeaders = (
    <tr className="border-b border-gray-200 bg-gray-50">
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Contraseña</th>
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Creado</th>
      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
    </tr>
  );

  const renderRow = (u: AdminUser) => {
    const ps = passwordStatus(u);
    return (
      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
        <td className="px-4 py-3 font-medium text-gray-900">{u.full_name || '-'}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
        {isStaff && <td className="px-4 py-3"><Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABELS[u.role]}</Badge></td>}
        <td className="px-4 py-3"><Badge variant={u.active ? 'success' : 'danger'}>{u.active ? 'Activo' : 'Inactivo'}</Badge></td>
        <td className="px-4 py-3"><Badge variant={ps.variant}>{ps.label}</Badge></td>
        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(u.created_at)}</td>
        <td className="px-4 py-3">
          <Link to={`/admin/usuarios/${u.id}`} aria-label={`Ver usuario ${userLabel(u)}`}>
            <Button variant="ghost" size="sm"><Eye size={14} /></Button>
          </Link>
        </td>
      </tr>
    );
  };

  return (
    <DashboardLayout role="admin" title="Usuarios">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usuarios</h2>
          <p className="text-gray-500">Gestión de personal interno y responsables de edificios</p>
        </div>

        <div role="tablist" aria-label="Tipos de usuarios" className="flex border-b border-gray-200">
          <button type="button" id="tab-usuarios" role="tab" aria-selected={activeTab === 'usuarios'} aria-controls="panel-usuarios" onClick={() => switchTab('usuarios')} className={`px-4 py-2 text-sm transition-colors ${activeTab === 'usuarios' ? TAB_ACTIVE : TAB_INACTIVE}`}>Usuarios</button>
          <button type="button" id="tab-responsables" role="tab" aria-selected={activeTab === 'responsables'} aria-controls="panel-responsables" onClick={() => switchTab('responsables')} className={`px-4 py-2 text-sm transition-colors ${activeTab === 'responsables' ? TAB_ACTIVE : TAB_INACTIVE}`}>Responsables de edificios</button>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-gray-500">
              {tabCount === 0 ? (isStaff ? '0 usuarios' : '0 responsables') : `${tabCount} ${tabCount === 1 ? (isStaff ? 'usuario' : 'responsable') : (isStaff ? 'usuarios' : 'responsables')}`}
              {hasFilters && ` — Mostrando ${filteredCount} de ${tabCount}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadUsers} disabled={loading} aria-label="Actualizar usuarios">
              <RefreshCw size={14} className="mr-1" /> Actualizar
            </Button>
            {isStaff && <Link to="/admin/usuarios/nuevo"><Button><Plus size={16} className="mr-2" /> Nuevo usuario</Button></Link>}
            {!isStaff && <Link to="/admin/usuarios/responsables/nuevo"><Button><Plus size={16} className="mr-2" /> Nuevo responsable</Button></Link>}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading} aria-label="Reintentar carga de usuarios">Reintentar</Button>
          </div>
        )}

        <Card><CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Buscar por nombre o email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {isStaff && <Select label="Filtrar por rol" options={STAFF_ROLE_OPTIONS} value={filterRole} onChange={(e) => handleRoleFilter(e.target.value)} />}
          </div>
        </CardContent></Card>

        <div role="tabpanel" id={isStaff ? 'panel-usuarios' : 'panel-responsables'} aria-labelledby={isStaff ? 'tab-usuarios' : 'tab-responsables'}>
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{isStaff ? 'Usuarios' : 'Responsables de edificios'}</h3>
            <p className="text-sm text-gray-500">{isStaff ? 'Personal interno con acceso administrativo, técnico o de supervisión.' : 'Usuarios externos vinculados a los ascensores de uno o más edificios.'}</p>
          </div>
          <Card><CardContent className="p-0">
            {loading ? (
            <div className="flex justify-center py-12" aria-label="Cargando usuarios">
              <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">{hasFilters ? (isStaff ? 'No se encontraron usuarios' : 'No se encontraron responsables') : (isStaff ? 'No hay usuarios registrados' : 'No hay responsables de edificios registrados')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>{isStaff ? staffHeaders : respHeaders}</thead>
                <tbody>{filtered.map(renderRow)}</tbody>
              </table>
            </div>
          )}
        </CardContent></Card></div>
      </div>
    </DashboardLayout>
  );
}
