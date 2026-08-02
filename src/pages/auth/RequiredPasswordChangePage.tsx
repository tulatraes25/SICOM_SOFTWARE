import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { completeRequiredPasswordChange } from '@/services/requiredPasswordChange.service';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Eye, EyeOff, LogOut } from 'lucide-react';

export default function RequiredPasswordChangePage() {
  const navigate = useNavigate();
  const { logout, profile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submitRef = useRef(false);

  const isValid = newPassword.trim().length >= 8
    && newPassword.length <= 128
    && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitRef.current) return;
    submitRef.current = true;
    setError('');
    setLoading(true);

    try {
      await completeRequiredPasswordChange(newPassword);
      await logout();
      navigate('/login', {
        replace: true,
        state: { passwordChanged: true },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.');
      submitRef.current = false;
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Cambio obligatorio de contraseña</h1>
          <p className="text-gray-600 text-sm">
            Por seguridad, reemplazá la contraseña temporal antes de ingresar al sistema.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {error && (
            <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                label="Nueva contraseña"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
                tabIndex={-1}
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Confirmar contraseña"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {newPassword.length > 0 && newPassword.length < 8 && (
              <p role="alert" className="text-danger text-xs">La contraseña debe tener al menos 8 caracteres.</p>
            )}
            {newPassword.length > 128 && (
              <p role="alert" className="text-danger text-xs">La contraseña no puede tener más de 128 caracteres.</p>
            )}
            {newPassword.length >= 8 && confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p role="alert" className="text-danger text-xs">Las contraseñas no coinciden.</p>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              disabled={!isValid || loading}
            >
              {loading ? 'Actualizando...' : 'Actualizar contraseña'}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-200 text-center">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </div>

        {profile && (
          <p className="mt-4 text-center text-xs text-gray-400">
            Conectado como: {profile.email}
          </p>
        )}
      </div>
    </div>
  );
}
