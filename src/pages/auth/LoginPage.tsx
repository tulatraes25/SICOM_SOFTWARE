import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { COMPANY_NAME, COMPANY_WEBSITE } from '@/config/constants';
import { SICOM_IMAGES } from '@/config/assets';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading: authLoading, isAuthenticated, getRedirectPath } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    navigate(getRedirectPath(), { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.profile) {
      navigate(getRedirectPath(), { replace: true });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding with image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${SICOM_IMAGES.hero})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/90 to-accent/80" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <img src={SICOM_IMAGES.logo} alt={COMPANY_NAME} className="h-16 mb-8 brightness-0 invert" />

          <h2 className="text-4xl font-bold mb-4 leading-tight">
            Trazabilidad y mantenimiento de ascensores
          </h2>

          <p className="text-white/80 text-lg mb-8">
            Control total sobre el estado, mantenimiento e informes técnicos de cada ascensor mediante código QR.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-secondary/30 rounded-lg flex items-center justify-center text-sm">✓</div>
              <span>QR único por ascensor</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-secondary/30 rounded-lg flex items-center justify-center text-sm">✓</div>
              <span>Informes asistidos por IA</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-secondary/30 rounded-lg flex items-center justify-center text-sm">✓</div>
              <span>PDF y envío automático</span>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/20">
            <a 
              href={COMPANY_WEBSITE} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ExternalLink size={14} />
              {COMPANY_WEBSITE}
            </a>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <img src={SICOM_IMAGES.logo} alt={COMPANY_NAME} className="h-14 mx-auto mb-4" />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Iniciar Sesión</h2>
            <p className="text-gray-600">Ingresa tus credenciales para acceder</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
                {error}
              </div>
            )}

            <Input
              label="Correo Electrónico"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <div className="relative">
              <Input
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full bg-secondary hover:bg-secondary-dark"
              size="lg"
              loading={loading || authLoading}
            >
              Iniciar Sesión
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p className="mb-2">¿Olvidaste tu contraseña? Contactá al administrador.</p>
            <p className="text-xs text-gray-400">
              Los usuarios deben ser creados desde el panel de Supabase Auth.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <img src={SICOM_IMAGES.logo} alt={COMPANY_NAME} className="h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs text-gray-400">{COMPANY_NAME}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
