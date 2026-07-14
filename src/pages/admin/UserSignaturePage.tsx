import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getMySignatures, uploadSignature, revokeSignature, getSignatureUrl } from '@/services/userSignatures.service';
import { SIGNATURE_TYPE_LABELS } from '@/types/database';
import type { UserSignature, SignatureType } from '@/types/database';
import { Upload, Trash2, AlertCircle, Check, Image as ImageIcon } from 'lucide-react';

const SIGNATURE_TYPES: SignatureType[] = ['technician', 'administrator', 'supervisor', 'representative'];

export default function UserSignaturePage() {
  const [signatures, setSignatures] = useState<UserSignature[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedType, setSelectedType] = useState<SignatureType>('technician');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSignatures();
  }, []);

  const loadSignatures = async () => {
    try {
      const data = await getMySignatures();
      setSignatures(data);

      const urlMap: Record<string, string> = {};
      for (const sig of data) {
        const url = await getSignatureUrl(sig.storage_path);
        if (url) urlMap[sig.id] = url;
      }
      setUrls(urlMap);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar firmas');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      await uploadSignature(file, selectedType);
      setSuccess('Firma cargada correctamente');
      await loadSignatures();
    } catch (err: any) {
      const msg = err?.message || 'Error al cargar firma';
      // Hide technical RLS/storage errors from user
      if (msg.includes('row-level') || msg.includes('policy') || msg.includes('RLS')) {
        setError('No se pudo cargar la firma. Verificá tu sesión e intentá nuevamente.');
      } else {
        setError(msg);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRevoke = async (sigId: string) => {
    if (!confirm('¿Revocar esta firma? No se eliminará de documentos ya firmados.')) return;

    try {
      await revokeSignature(sigId);
      setSuccess('Firma revocada correctamente');
      await loadSignatures();
    } catch (err: any) {
      setError(err?.message || 'Error al revocar firma');
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin" title="Mi Firma">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" title="Mi Firma">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Firma para Documentos</h2>
          <p className="text-gray-500 mt-1">
            Esta firma será utilizada en los documentos que apruebes o firmes.
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
            <h3 className="font-semibold">Subir Nueva Firma</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de firma</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as SignatureType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {SIGNATURE_TYPES.map((t) => (
                  <option key={t} value={t}>{SIGNATURE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
              <ImageIcon size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-2">
                Arrastrá una imagen o hacé click para seleccionar
              </p>
              <p className="text-xs text-gray-400 mb-3">
                PNG o JPEG, máximo 2 MB. Preferencia: fondo transparente.
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={16} className="mr-2" />
                {uploading ? 'Subiendo...' : 'Seleccionar archivo'}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,.jpg,.jpeg"
              onChange={handleUpload}
              className="hidden"
            />

            <div className="p-3 bg-info/10 border border-info/30 rounded text-info text-sm">
              <p><strong>Recomendaciones:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Firmá sobre una hoja blanca con tinta oscura</li>
                <li>Sacá una foto o escaneala</li>
                <li>Para mejor resultado, utilizá una imagen con fondo transparente (PNG)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Mis Firmas</h3>
          </CardHeader>
          <CardContent>
            {signatures.length === 0 ? (
              <p className="text-gray-500 text-sm">No tenés firmas cargadas</p>
            ) : (
              <div className="space-y-4">
                {signatures.map((sig) => (
                  <div key={sig.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    {urls[sig.id] ? (
                      <img
                        src={urls[sig.id]}
                        alt="Firma"
                        className="h-16 w-32 object-contain border rounded"
                      />
                    ) : (
                      <div className="h-16 w-32 bg-gray-100 rounded flex items-center justify-center">
                        <ImageIcon size={20} className="text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={sig.is_active ? 'success' : 'default'}>
                          {SIGNATURE_TYPE_LABELS[sig.signature_type]}
                        </Badge>
                        {sig.is_active && <Badge variant="info">Activa</Badge>}
                        {!sig.is_active && <Badge variant="default">Revocada</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Cargada: {new Date(sig.created_at).toLocaleDateString('es-AR')}
                      </p>
                      {sig.revoked_at && (
                        <p className="text-xs text-danger mt-1">
                          Revocada: {new Date(sig.revoked_at).toLocaleDateString('es-AR')}
                        </p>
                      )}
                    </div>
                    {sig.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(sig.id)}
                      >
                        <Trash2 size={14} className="text-danger" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
