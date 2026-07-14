import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getNumberingSettings, activateProductionNumbering } from '@/services/serviceCases.service';
import type { DocumentNumberingSettings } from '@/types/database';
import { AlertTriangle, Settings } from 'lucide-react';

export default function NumberingConfigPage() {
  const [settings, setSettings] = useState<DocumentNumberingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getNumberingSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (confirmText !== 'ACTIVAR') return;
    setActivating(true);
    setError('');
    try {
      const result = await activateProductionNumbering();
      setSuccess(`Numeración productiva activada. Próximo número: ${result.next_production_number}`);
      setConfirmText('');
      await loadSettings();
    } catch (err: any) {
      setError(err?.message || 'Error al activar');
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin" title="Configuración de Numeración">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const isTest = settings?.current_mode === 'test';

  return (
    <DashboardLayout role="admin" title="Configuración de Numeración">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Settings size={24} className="text-gray-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Numeración de Expedientes</h2>
            <p className="text-gray-500">Configuración global de numeración</p>
          </div>
        </div>

        {isTest && (
          <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-3">
            <AlertTriangle size={20} className="text-warning shrink-0" />
            <p className="text-sm text-warning font-medium">Numeración de prueba activa</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm">
            {success}
          </div>
        )}

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Estado Actual</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Modo actual</p>
                <Badge variant={isTest ? 'warning' : 'success'} className="text-lg px-3 py-1">
                  {isTest ? 'PRUEBAS' : 'PRODUCCIÓN'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Próximo número de prueba</p>
                <p className="text-2xl font-bold text-gray-900">{settings?.next_test_number || 1900}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Próximo número productivo</p>
                <p className="text-2xl font-bold text-gray-900">{settings?.next_production_number || 2000}</p>
              </div>
              {settings?.production_activated_at && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Activado el</p>
                  <p className="text-lg font-medium text-gray-900">
                    {new Date(settings.production_activated_at).toLocaleString('es-AR')}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isTest && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-danger">Activar Numeración Productiva</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-danger/5 border border-danger/20 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Advertencia:</strong> Al activar la numeración productiva, los nuevos expedientes comenzarán desde el <strong>N.º 2000</strong> y no se podrá volver al modo de prueba.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Escriba <strong>ACTIVAR</strong> para confirmar:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="ACTIVAR"
                />
              </div>

              <Button
                variant="danger"
                onClick={handleActivate}
                disabled={confirmText !== 'ACTIVAR' || activating}
              >
                {activating ? 'Activando...' : 'Activar Numeración Productiva desde 2000'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
