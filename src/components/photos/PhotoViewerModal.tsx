import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoViewerModalProps {
  photos: Array<{ id: string; signedUrl?: string; photo_type?: string }>;
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export default function PhotoViewerModal({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onPrevious,
  onNext,
}: PhotoViewerModalProps) {
  const currentPhoto = photos[currentIndex];
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && hasPrevious) onPrevious();
    if (e.key === 'ArrowRight' && hasNext) onNext();
  }, [hasPrevious, hasNext, onClose, onPrevious, onNext]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !currentPhoto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Fotografía ${currentIndex + 1} de ${photos.length}`}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
        aria-label="Cerrar"
      >
        <X size={24} />
      </button>

      {/* Previous button */}
      {hasPrevious && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrevious(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
          aria-label="Fotografía anterior"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Next button */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
          aria-label="Siguiente fotografía"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Image */}
      <div className="max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        {currentPhoto.signedUrl ? (
          <img
            src={currentPhoto.signedUrl}
            alt={`Fotografía del mantenimiento ${currentIndex + 1}`}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
          />
        ) : (
          <div className="bg-white/10 rounded-lg p-8 text-center text-white">
            <p>Archivo no disponible</p>
          </div>
        )}
      </div>

      {/* Counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-black/50 rounded-full text-white text-sm">
        {currentIndex + 1} de {photos.length}
      </div>
    </div>
  );
}
