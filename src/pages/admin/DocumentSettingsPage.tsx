import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { getDocumentSettings, updateDocumentSettings } from '@/services/documentSettings.service';
import type { CompanyDocumentSettings } from '@/types/database';
import { AlertCircle, Check } from 'lucide-react';

export default function DocumentSettingsPage() {
  const [settings, setSettings] = useState<CompanyDocumentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getDocumentSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await updateDocumentSettings(settings);
      setSuccess('Configuración guardada correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof CompanyDocumentSettings, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value || undefined });
  };

  if (loading) {
    return (
      <DashboardLayout role="admin" title="Configuración Documental">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" title="Configuración Documental">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuración de Documentos</h2>
          <p className="text-gray-500 mt-1">
            Datos institucionales que aparecen en membrete y pie de documentos.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2">
            <Check size={16} /> {success}
          </div>
        )}

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Datos de la Empresa</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Nombre de empresa"
              value={settings?.company_name || ''}
              onChange={(e) => updateField('company_name', e.target.value)}
            />
            <Input
              label="Razón social"
              value={settings?.legal_name || ''}
              onChange={(e) => updateField('legal_name', e.target.value)}
              placeholder="Opcional"
            />
            <Input
              label="CUIT"
              value={settings?.tax_id || ''}
              onChange={(e) => updateField('tax_id', e.target.value)}
              placeholder="Opcional"
            />
            <Input
              label="Domicilio"
              value={settings?.address || ''}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Opcional"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Teléfono"
                value={settings?.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
              />
              <Input
                label="Correo"
                value={settings?.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <Input
              label="Sitio web"
              value={settings?.website || ''}
              onChange={(e) => updateField('website', e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Textos de Documentos</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Texto de encabezado</label>
              <textarea
                value={settings?.header_text || ''}
                onChange={(e) => updateField('header_text', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                rows={2}
                placeholder="Texto adicional en el encabezado..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Texto de pie</label>
              <textarea
                value={settings?.footer_text || ''}
                onChange={(e) => updateField('footer_text', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                rows={2}
                placeholder="Texto adicional en el pie..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Colores</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Color primario"
                value={settings?.primary_color || '#8DB600'}
                onChange={(e) => updateField('primary_color', e.target.value)}
              />
              <Input
                label="Color secundario"
                value={settings?.secondary_color || '#06172E'}
                onChange={(e) => updateField('secondary_color', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
