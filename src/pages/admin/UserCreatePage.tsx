import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { createUser } from '@/services/adminUsers.service';
import { AlertCircle, Check } from 'lucide-react';

const ROLE_OPTIONS = Object.entries({ admin: 'Administrador', supervisor: 'Supervisor', technician: 'Técnico', responsible: 'Responsable' }).map(([v, l]) => ({ value: v, label: l }));

export default function UserCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('technician');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!fullName.trim()) { setError('El nombre es obligatorio'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Ingresá un email válido'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }

    setLoading(true);
    try {
      const result = await createUser({ email, password, full_name: fullName.trim(), role });
      setSuccess(`Usuario ${fullName} creado correctamente`);
      setTimeout(() => navigate(`/admin/usuarios/${result.id}`), 1500);
    } catch (err: any) {
      setError(err?.message || 'Error al crear usuario');
    } finally { setLoading(false); }
  };

  return (
    <DashboardLayout role="admin" title="Nuevo Usuario">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/admin/usuarios')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /> Volver</button>
        <Card><CardHeader><h2 className="text-lg font-semibold">Crear Usuario</h2></CardHeader><CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
            {success && <div className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2"><Check size={16} /> {success}</div>}
            <Input label="Nombre completo *" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select label="Rol *" options={ROLE_OPTIONS} value={role} onChange={(e) => setRole(e.target.value)} />
            <Input label="Contraseña *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            <Input label="Confirmar contraseña *" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate('/admin/usuarios')}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear Usuario'}</Button>
            </div>
          </form>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}

function ArrowLeft({ size, className }: { size: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m15 18-6-6 6-6"/></svg>;
}
