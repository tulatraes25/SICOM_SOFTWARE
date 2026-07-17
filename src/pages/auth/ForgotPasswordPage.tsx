import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { AlertCircle, Check, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Ingresá tu correo electrónico'); return; }
    setLoading(true); setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/actualizar-contrasena`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      // Always show success to prevent email enumeration
      setSent(true);
    } finally { setLoading(false); }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <Check size={48} className="mx-auto text-success mb-4" />
            <h2 className="text-xl font-bold mb-2">Correo enviado</h2>
            <p className="text-gray-600 text-sm mb-6">
              Si el correo corresponde a una cuenta registrada, recibirás un enlace para restablecer tu contraseña.
            </p>
            <Link to="/login"><Button>Volver al inicio de sesión</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-8">
          <Link to="/login" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft size={18} /> Volver</Link>
          <h2 className="text-xl font-bold mb-2">Recuperar contraseña</h2>
          <p className="text-gray-600 text-sm mb-6">Ingresá tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
          {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2 mb-4"><AlertCircle size={16} /> {error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Correo electrónico" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Enviando...' : 'Enviar enlace de recuperación'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
