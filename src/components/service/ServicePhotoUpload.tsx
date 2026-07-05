import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { uploadServicePhoto, deleteServicePhoto } from '@/services/serviceRecords.service';
import type { ServicePhoto } from '@/types/database';

interface ServicePhotoUploadProps {
  serviceRecordId: string;
  photos: ServicePhoto[];
  onPhotosChange: (photos: ServicePhoto[]) => void;
  readOnly?: boolean;
}

export default function ServicePhotoUpload({
  serviceRecordId,
  photos,
  onPhotosChange,
  readOnly = false,
}: ServicePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError('');
    setUploading(true);

    try {
      const newPhotos: ServicePhoto[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          setError(`Archivo ${file.name} excede 5MB`);
          continue;
        }
        const photo = await uploadServicePhoto(serviceRecordId, file);
        newPhotos.push(photo);
      }

      onPhotosChange([...photos, ...newPhotos]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir fotos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('¿Eliminar esta foto?')) return;

    try {
      await deleteServicePhoto(photoId);
      onPhotosChange(photos.filter(p => p.id !== photoId));
    } catch (err) {
      console.error('Error deleting photo:', err);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-700">Fotos</h4>
      
      {error && (
        <div className="p-2 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
              <ImageIcon size={24} className="text-gray-400" />
            </div>
            {!readOnly && (
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

        {!readOnly && (
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
        accept="image/*"
        multiple
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
