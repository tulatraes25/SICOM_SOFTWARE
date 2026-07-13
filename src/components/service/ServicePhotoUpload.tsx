import { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
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

export default function ServicePhotoUpload({
  serviceRecordId,
  serviceStatus = 'draft',
  photos,
  onPhotosChange,
  readOnly = false,
}: ServicePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = serviceStatus === 'draft' || serviceStatus === 'rejected';

  // Load signed URLs for existing photos
  useEffect(() => {
    loadPhotoUrls();
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

    setError('');
    setUploading(true);

    try {
      const newPhotos: ServicePhoto[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate type
        if (!ALLOWED_TYPES.includes(file.type)) {
          setError(`El archivo ${file.name} debe ser JPG, PNG o WebP`);
          continue;
        }

        // Validate size
        if (file.size > MAX_SIZE) {
          setError(`El archivo ${file.name} supera el tamaño máximo de 10 MB`);
          continue;
        }

        // Upload to Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${serviceRecordId}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('service-photos')
          .upload(fileName, file);

        if (uploadError) {
          setError('No se pudo subir la fotografía');
          continue;
        }

        // Insert record
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
          // Rollback: delete uploaded file
          await supabase.storage.from('service-photos').remove([fileName]);
          setError('No se pudo registrar la fotografía');
          continue;
        }

        newPhotos.push(data);
      }

      if (newPhotos.length > 0) {
        onPhotosChange([...photos, ...newPhotos]);
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
      <h4 className="font-medium text-gray-700">Fotos</h4>

      {!canEdit && !readOnly && (
        <p className="text-sm text-gray-500">
          Este mantenimiento ya no permite agregar fotografías.
        </p>
      )}

      {error && (
        <div className="p-2 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
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

        {canEdit && !readOnly && (
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
    </div>
  );
}
