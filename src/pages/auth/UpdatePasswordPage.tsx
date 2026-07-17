import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { AlertCircle, Check } from 'lucide-react';

export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar contraseña');
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <Check size={48} className="mx-auto text-success mb-4" />
            <h2 className="text-xl font-bold mb-2">Contraseña actualizada</h2>
            <p className="text-gray-600 text-sm">Serás redirigido al inicio de sesión.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-8">
          <h2 className="text-xl font-bold mb-2">Actualizar contraseña</h2>
          <p className="text-gray-600 text-sm mb-6">Ingresá tu nueva contraseña.</p>
          {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2 mb-4"><AlertCircle size={16} /> {error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nueva contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            <Input label="Confirmar contraseña" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Actualizando...' : 'Actualizar contraseña'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
