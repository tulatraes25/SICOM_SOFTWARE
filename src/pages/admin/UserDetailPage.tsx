import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { getUser, updateUser, resetPassword } from '@/services/adminUsers.service';
import type { AdminUser } from '@/services/adminUsers.service';
import { ArrowLeft, AlertCircle, Check, Key, UserX, UserCheck } from 'lucide-react';

const ROLE_OPTIONS = Object.entries({ admin: 'Administrador', supervisor: 'Supervisor', technician: 'Técnico', responsible: 'Responsable' }).map(([v, l]) => ({ value: v, label: l }));
const ROLE_BADGE: Record<string, 'default' | 'success' | 'warning' | 'info' | 'danger'> = { admin: 'danger', supervisor: 'warning', technician: 'info', responsible: 'default' };
const ROLE_LABELS: Record<string, string> = { admin: 'Administrador', supervisor: 'Supervisor', technician: 'Técnico', responsible: 'Responsable' };

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => { if (id) loadUser(); }, [id]);

  const loadUser = async () => {
    if (!id) return;
    try {
      const data = await getUser(id);
      setUser(data);
      setFullName(data.full_name);
      setRole(data.role);
    } catch (err: any) { setError(err?.message || 'Error'); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!id) return;
    setError(''); setSuccess('');
    try {
      await updateUser(id, { full_name: fullName, role });
      setSuccess('Usuario actualizado');
      setEditing(false);
      await loadUser();
    } catch (err: any) { setError(err?.message || 'Error'); }
  };

  const handleToggleActive = async () => {
    if (!id || !user) return;
    setError(''); setSuccess('');
    try {
      await updateUser(id, { active: !user.active });
      setSuccess(user.active ? 'Usuario desactivado' : 'Usuario reactivado');
      await loadUser();
    } catch (err: any) { setError(err?.message || 'Error'); }
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
    } catch (err: any) { setError(err?.message || 'Error'); }
  };

  if (loading) return <DashboardLayout role="admin" title="Usuario"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (!user) return null;

  return (
    <DashboardLayout role="admin" title="Detalle de Usuario">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/admin/usuarios')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /> Volver</button>

        {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        {success && <div className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2"><Check size={16} /> {success}</div>}

        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <h3 className="font-semibold">Datos del Usuario</h3>
            {!editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>}
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                <Input label="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <Select label="Rol" options={ROLE_OPTIONS} value={role} onChange={(e) => setRole(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(false); setFullName(user.full_name); setRole(user.role); }}>Cancelar</Button>
                  <Button size="sm" onClick={handleSave}>Guardar</Button>
                </div>
              </>
            ) : (
              <div className="space-y-3 text-sm">
                <div><span className="text-gray-500">Nombre: </span><span className="font-medium">{user.full_name || '-'}</span></div>
                <div><span className="text-gray-500">Email: </span><span className="font-medium">{user.email}</span></div>
                <div><span className="text-gray-500">Rol: </span><Badge variant={ROLE_BADGE[user.role]}>{ROLE_LABELS[user.role]}</Badge></div>
                <div><span className="text-gray-500">Estado: </span><Badge variant={user.active ? 'success' : 'danger'}>{user.active ? 'Activo' : 'Inactivo'}</Badge></div>
                <div><span className="text-gray-500">Creado: </span>{user.created_at ? new Date(user.created_at).toLocaleDateString('es-AR') : '-'}</div>
                {user.last_sign_in_at && <div><span className="text-gray-500">Último acceso: </span>{new Date(user.last_sign_in_at).toLocaleString('es-AR')}</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold">Acciones</h3></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => setShowResetModal(true)}>
              <Key size={16} className="mr-2" /> Restablecer contraseña
            </Button>
            <Button variant={user.active ? 'danger' : 'outline'} className="w-full justify-start" onClick={handleToggleActive}>
              {user.active ? <><UserX size={16} className="mr-2" /> Desactivar usuario</> : <><UserCheck size={16} className="mr-2" /> Reactivar usuario</>}
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
