import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { createUser, getAdminUsersErrorMessage } from '@/services/adminUsers.service';
import type { AdminUserRole } from '@/services/adminUsers.service';
import { AlertCircle, Check, ArrowLeft } from 'lucide-react';

const ROLE_OPTIONS: { value: AdminUserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'technician', label: 'Técnico' },
  { value: 'responsible', label: 'Responsable' },
];

const VALID_ROLES: readonly string[] = ['admin', 'supervisor', 'technician', 'responsible'];

function isValidRole(v: string): v is AdminUserRole {
  return (VALID_ROLES as readonly string[]).includes(v);
}

function isValidEmail(v: string): boolean {
  const t = v.trim();
  if (!t || t.includes(' ')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export default function UserCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminUserRole>('technician');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const submitRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitRef.current) return;
    setError(''); setSuccess('');

    if (!fullName.trim()) { setError('El nombre es obligatorio'); return; }
    if (!isValidEmail(email)) { setError('Ingresá un email válido'); return; }
    if (password.trim().length === 0 || password.length < 8 || password.length > 128) {
      setError('La contraseña debe tener entre 8 y 128 caracteres'); return;
    }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }

    submitRef.current = true;
    setLoading(true);
    try {
      const result = await createUser({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        role,
      });
      const msg = role === 'responsible'
        ? 'Responsable creado correctamente. Deberá cambiar su contraseña temporal al iniciar sesión.'
        : 'Usuario creado correctamente.';
      setSuccess(msg);
      setPassword(''); setConfirmPassword('');
      timerRef.current = setTimeout(() => navigate(`/admin/usuarios/${result.id}`), 800);
    } catch (err: unknown) {
      submitRef.current = false;
      setError(getAdminUsersErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (v: string) => {
    if (isValidRole(v)) setRole(v);
  };

  const isBusy = loading || success !== '';

  return (
    <DashboardLayout role="admin" title="Nuevo Usuario">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => { if (!isBusy) navigate('/admin/usuarios'); }}
          disabled={isBusy}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
          aria-label="Volver"
        >
          <ArrowLeft size={18} /> Volver
        </button>

        <Card><CardHeader><h2 className="text-lg font-semibold">Crear Usuario</h2></CardHeader><CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isBusy}>
            {error && <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
            {success && <div role="status" className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2"><Check size={16} /> {success}</div>}

            <Input label="Nombre completo *" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" disabled={isBusy} />
            <Input label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={isBusy} />
            <Select label="Rol *" options={ROLE_OPTIONS} value={role} onChange={(e) => handleRoleChange(e.target.value)} disabled={isBusy} />
            <Input label="Contraseña *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" disabled={isBusy} />
            <Input label="Confirmar contraseña *" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" disabled={isBusy} />

            {role === 'responsible' && (
              <div role="note" className="p-3 bg-warning/10 border border-warning/30 rounded text-warning text-sm">
                <p>Esta contraseña será temporal. El responsable deberá cambiarla la primera vez que inicie sesión.</p>
                <p className="mt-1">Entregale esta contraseña de forma segura. El sistema no volverá a mostrarla.</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => { if (!isBusy) navigate('/admin/usuarios'); }} disabled={isBusy}>Cancelar</Button>
              <Button type="submit" disabled={isBusy}>{loading ? 'Creando...' : 'Crear Usuario'}</Button>
            </div>
          </form>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
