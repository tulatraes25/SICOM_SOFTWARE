import { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { supabase } from '@/config/supabase';
import type { ServicePhoto } from '@/types/database';

interface ServicePhotoUploadProps {
  serviceRecordId: string;
  serviceStatus?: string;
  photos: ServicePhoto[];
  onPhotosChange: (photos: ServicePhoto[]) => void;
  readOnly?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PHOTOS = 10;

export default function ServicePhotoUpload({
  serviceRecordId,
  serviceStatus = 'draft',
  photos,
  onPhotosChange,
  readOnly = false,
}: ServicePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = serviceStatus === 'draft' || serviceStatus === 'rejected';

  useEffect(() => {
    loadPhotoUrls();
    return () => {
      // Cleanup object URLs
      Object.values(photoUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [photos]);

  const loadPhotoUrls = async () => {
    const urls: Record<string, string> = {};
    for (const photo of photos) {
      if (photo.storage_path) {
        const { data } = await supabase.storage
          .from('service-photos')
          .createSignedUrl(photo.storage_path, 3600);
        if (data?.signedUrl) {
          urls[photo.id] = data.signedUrl;
        }
      }
    }
    setPhotoUrls(urls);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!canEdit) {
      setError('Este mantenimiento ya no permite agregar fotografías');
      return;
    }

    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`Máximo ${MAX_PHOTOS} fotografías por mantenimiento`);
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);

    try {
      const newPhotos: ServicePhoto[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!ALLOWED_TYPES.includes(file.type)) {
          setError(`El archivo ${file.name} debe ser JPG, PNG o WebP`);
          continue;
        }

        if (file.size > MAX_SIZE) {
          setError(`El archivo ${file.name} supera el tamaño máximo de 10 MB`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${serviceRecordId}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('service-photos')
          .upload(fileName, file);

        if (uploadError) {
          setError('No se pudo subir la fotografía');
          continue;
        }

        const { data, error: insertError } = await supabase
          .from('service_photos')
          .insert({
            service_record_id: serviceRecordId,
            storage_path: fileName,
            photo_type: 'general',
          })
          .select()
          .single();

        if (insertError) {
          await supabase.storage.from('service-photos').remove([fileName]);
          setError('No se pudo registrar la fotografía');
          continue;
        }

        newPhotos.push(data);
      }

      if (newPhotos.length > 0) {
        onPhotosChange([...photos, ...newPhotos]);
        setSuccess('La fotografía fue cargada correctamente');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir fotos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('¿Eliminar esta foto?')) return;

    try {
      const { data } = await supabase
        .from('service_photos')
        .select('storage_path')
        .eq('id', photoId)
        .single();

      if (data?.storage_path) {
        await supabase.storage.from('service-photos').remove([data.storage_path]);
      }

      await supabase.from('service_photos').delete().eq('id', photoId);
      onPhotosChange(photos.filter(p => p.id !== photoId));
    } catch (err) {
      console.error('Error deleting photo:', err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-700">Fotos ({photos.length}/{MAX_PHOTOS})</h4>
      </div>

      {!canEdit && !readOnly && (
        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded text-sm text-gray-600">
          <AlertCircle size={14} />
          Este mantenimiento ya no permite agregar fotografías.
        </div>
      )}

      {error && (
        <div className="p-2 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {success && (
        <div className="p-2 bg-success/10 border border-success/30 rounded text-success text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group">
            <div
              className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
              onClick={() => setSelectedPreview(photoUrls[photo.id] || null)}
            >
              {photoUrls[photo.id] ? (
                <img
                  src={photoUrls[photo.id]}
                  alt={photo.photo_type}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={24} className="text-gray-400" />
                </div>
              )}
            </div>
            {canEdit && !readOnly && (
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                className="absolute top-1 right-1 p-1 bg-danger text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            )}
            <p className="text-xs text-gray-500 mt-1 truncate">{photo.photo_type}</p>
          </div>
        ))}

        {canEdit && !readOnly && photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Upload size={20} />
                <span className="text-xs mt-1">Agregar</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleUpload}
        className="hidden"
      />

      {/* Modal preview */}
      {selectedPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedPreview(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={selectedPreview}
              alt="Vista previa"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedPreview(null)}
              className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}