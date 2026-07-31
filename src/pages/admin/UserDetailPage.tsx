import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { getUser, updateUser, resetPassword, getAdminUsersErrorMessage } from '@/services/adminUsers.service';
import type { AdminUser, AdminUserRole } from '@/services/adminUsers.service';
import { ArrowLeft, AlertCircle, Check, Key, UserX, UserCheck } from 'lucide-react';

const ROLE_OPTIONS: { value: AdminUserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'technician', label: 'Técnico' },
  { value: 'responsible', label: 'Responsable' },
];
const VALID_ROLES: readonly string[] = ['admin', 'supervisor', 'technician', 'responsible'];
const ROLE_BADGE: Record<AdminUserRole, 'default' | 'success' | 'warning' | 'info' | 'danger'> = { admin: 'danger', supervisor: 'warning', technician: 'info', responsible: 'default' };
const ROLE_LABELS: Record<AdminUserRole, string> = { admin: 'Administrador', supervisor: 'Supervisor', technician: 'Técnico', responsible: 'Responsable' };

function isValidRole(v: string): v is AdminUserRole {
  return (VALID_ROLES as readonly string[]).includes(v);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-AR');
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Nunca';
  return d.toLocaleString('es-AR');
}

function passwordStatus(u: AdminUser): { label: string; variant: 'default' | 'success' | 'warning' } {
  if (u.role !== 'responsible') return { label: 'No aplica', variant: 'default' };
  if (u.must_change_password) return { label: 'Cambio pendiente', variant: 'warning' };
  if (u.password_changed_at) return { label: 'Actualizada', variant: 'success' };
  return { label: 'Sin cambio pendiente', variant: 'default' };
}

type Operation = 'loading' | 'saving' | 'toggling' | null;

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AdminUserRole>('technician');
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [operation, setOperation] = useState<Operation>(null);
  const operationRef = useRef<Operation>(null);

  function beginOperation(next: Exclude<Operation, null>): boolean {
    if (operationRef.current !== null) return false;
    operationRef.current = next;
    setOperation(next);
    return true;
  }

  function endOperation(): void {
    operationRef.current = null;
    setOperation(null);
  }

  async function fetchUserData(): Promise<void> {
    if (!id) return;
    const data = await getUser(id);
    setUser(data);
    setFullName(data.full_name);
    setRole(data.role);
  }

  useEffect(() => { if (id) loadUser(); }, [id]);

  const loadUser = async () => {
    if (!id) return;
    if (!beginOperation('loading')) return;
    setError('');
    try {
      await fetchUserData();
    } catch (err: unknown) {
      setUser(null);
      setError(getAdminUsersErrorMessage(err));
    } finally {
      endOperation();
    }
  };

  const handleSave = async () => {
    if (!id) return;
    const normalizedName = fullName.trim();
    if (!normalizedName) {
      setError('El nombre es obligatorio');
      return;
    }
    if (!beginOperation('saving')) return;
    setError(''); setSuccess('');
    try {
      await updateUser(id, { full_name: normalizedName, role });
      setSuccess('Usuario actualizado correctamente');
      setEditing(false);
      await fetchUserData();
    } catch (err: unknown) {
      setError(getAdminUsersErrorMessage(err));
    } finally {
      endOperation();
    }
  };

  const handleToggleActive = async () => {
    if (!id || !user) return;
    if (!beginOperation('toggling')) return;
    setError(''); setSuccess('');
    try {
      await updateUser(id, { active: !user.active });
      setSuccess(user.active ? 'Usuario desactivado correctamente' : 'Usuario reactivado correctamente');
      await fetchUserData();
    } catch (err: unknown) {
      setError(getAdminUsersErrorMessage(err));
    } finally {
      endOperation();
    }
  };

  const handleResetPassword = async () => {
    if (!id) return;
    if (newPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }
    setError(''); setSuccess('');
    try {
      await resetPassword(id, newPassword);
      setSuccess('Contraseña restablecida correctamente');
      setShowResetModal(false);
      setNewPassword(''); setConfirmPassword('');
    } catch (err: unknown) {
      setError(getAdminUsersErrorMessage(err));
    }
  };

  if (operation === 'loading' && !user) {
    return (
      <DashboardLayout role="admin" title="Usuario">
        <div className="flex justify-center py-12" aria-label="Cargando usuario">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!id) {
    return (
      <DashboardLayout role="admin" title="Usuario">
        <div className="max-w-2xl mx-auto space-y-6">
          <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2">
            <AlertCircle size={16} /> No se indicó el usuario
          </div>
          <Button variant="outline" onClick={() => navigate('/admin/usuarios')} aria-label="Volver a usuarios">Volver a usuarios</Button>
        </div>
      </DashboardLayout>
    );
  }

  const isBusy = operation !== null;

  if (error && !user && operation !== 'loading') {
    return (
      <DashboardLayout role="admin" title="Detalle de Usuario">
        <div className="max-w-2xl mx-auto space-y-6">
          <button onClick={() => { if (!isBusy) navigate('/admin/usuarios'); }} disabled={isBusy} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 disabled:opacity-50" aria-label="Volver a usuarios">
            <ArrowLeft size={18} /> Volver
          </button>
          <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
            <Button variant="outline" size="sm" onClick={loadUser} disabled={isBusy} aria-label="Reintentar carga de usuario">Reintentar</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" title="Detalle de Usuario">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => { if (!isBusy) navigate('/admin/usuarios'); }} disabled={isBusy} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 disabled:opacity-50" aria-label="Volver a usuarios">
          <ArrowLeft size={18} /> Volver
        </button>

        {error && <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center justify-between"><span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span><Button variant="outline" size="sm" onClick={loadUser} disabled={isBusy} aria-label="Reintentar carga de usuario">Reintentar</Button></div>}
        {success && <div role="status" className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2"><Check size={16} /> {success}</div>}

        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <h3 className="font-semibold">Datos del Usuario</h3>
            {!editing && <Button variant="outline" size="sm" onClick={() => { setSuccess(''); setError(''); setEditing(true); }} disabled={isBusy}>Editar</Button>}
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <div aria-busy={operation === 'saving'}>
                <Input label="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={operation === 'saving'} />
                <Select label="Rol" options={ROLE_OPTIONS} value={role} onChange={(e) => { if (isValidRole(e.target.value)) setRole(e.target.value); }} disabled={operation === 'saving'} />
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(false); if (user) { setFullName(user.full_name); setRole(user.role); } setError(''); }} disabled={operation === 'saving'}>Cancelar edición</Button>
                  <Button size="sm" onClick={handleSave} disabled={operation === 'saving'}>{operation === 'saving' ? 'Guardando...' : 'Guardar'}</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div><span className="text-gray-500">Nombre: </span><span className="font-medium">{user?.full_name || '-'}</span></div>
                <div><span className="text-gray-500">Email: </span><span className="font-medium">{user?.email}</span></div>
                <div><span className="text-gray-500">Rol: </span><Badge variant={user ? ROLE_BADGE[user.role] : 'default'}>{user ? ROLE_LABELS[user.role] : '-'}</Badge></div>
                <div><span className="text-gray-500">Estado: </span><Badge variant={user?.active ? 'success' : 'danger'}>{user?.active ? 'Activo' : 'Inactivo'}</Badge></div>
                <div><span className="text-gray-500">Creado: </span>{user ? formatDate(user.created_at) : '-'}</div>
                <div><span className="text-gray-500">Último acceso: </span>{user ? formatDateTime(user.last_sign_in_at) : 'Nunca'}</div>
                {user && <div><span className="text-gray-500">Contraseña: </span><Badge variant={passwordStatus(user).variant}>{passwordStatus(user).label}</Badge></div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold">Acciones</h3></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => setShowResetModal(true)} disabled={isBusy}>
              <Key size={16} className="mr-2" /> Restablecer contraseña
            </Button>
            <Button variant={user?.active ? 'danger' : 'outline'} className="w-full justify-start" onClick={handleToggleActive} disabled={isBusy}>
              {operation === 'toggling'
                ? (user?.active ? 'Desactivando...' : 'Reactivando...')
                : (user?.active ? <><UserX size={16} className="mr-2" /> Desactivar usuario</> : <><UserCheck size={16} className="mr-2" /> Reactivar usuario</>)}
            </Button>
          </CardContent>
        </Card>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Restablecer Contraseña</h3>
            <div className="space-y-3">
              <Input label="Nueva contraseña" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
              <Input label="Confirmar contraseña" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowResetModal(false); setNewPassword(''); setConfirmPassword(''); }}>Cancelar</Button>
                <Button onClick={handleResetPassword} disabled={newPassword.length < 8 || newPassword !== confirmPassword}>Restablecer</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
