import { supabase } from '@/config/supabase';

/**
 * Descarga una foto JPEG desde Storage y la convierte a data URI para usar en PDF.
 * Solo acepta image/jpeg. Cualquier otro formato retorna null.
 */
export async function getPhotoAsDataUri(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('service-photos')
      .download(storagePath);

    if (error || !data) {
      console.error('[photoUtils] Error downloading photo:', error);
      return null;
    }

    if (data.size === 0) {
      console.error('[photoUtils] Empty file:', storagePath);
      return null;
    }

    // Verificar que sea JPEG por los primeros bytes (FF D8 FF)
    const header = await data.slice(0, 3).arrayBuffer();
    const headerBytes = new Uint8Array(header);
    const isJpeg = headerBytes[0] === 0xFF && headerBytes[1] === 0xD8 && headerBytes[2] === 0xFF;

    if (!isJpeg) {
      console.warn('[photoUtils] Not a JPEG, skipping:', storagePath, 'mime:', data.type);
      return null;
    }

    // Convertir Blob JPEG a base64
    const arrayBuffer = await data.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64 = btoa(
      uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    return `data:image/jpeg;base64,${base64}`;
  } catch (err) {
    console.error('[photoUtils] Error converting photo:', err);
    return null;
  }
}

/**
 * Procesa una lista de fotos para incluir en PDF.
 * Solo procesa archivos JPEG válidos.
 */
export async function processPhotosForPDF(
  photos: Array<{ id: string; storage_path: string; include_in_report?: boolean; report_order?: number }>
): Promise<Array<{ id: string; imageData: string | null; report_order: number }>> {
  const selected = photos.filter(p => p.include_in_report);

  const processed = await Promise.all(
    selected.map(async (photo) => ({
      id: photo.id,
      imageData: await getPhotoAsDataUri(photo.storage_path),
      report_order: photo.report_order || 0,
    }))
  );

  return processed.sort((a, b) => a.report_order - b.report_order);
}
