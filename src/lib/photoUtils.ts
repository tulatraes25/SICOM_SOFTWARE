import { supabase } from '@/config/supabase';

/**
 * Descarga una foto desde Storage y la convierte a data URI para usar en PDF
 */
export async function getPhotoAsDataUri(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('service-photos')
      .download(storagePath);

    if (error || !data) {
      console.error('Error downloading photo:', error);
      return null;
    }

    // Convertir Blob a base64
    const arrayBuffer = await data.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Detectar MIME type
    const firstBytes = String.fromCharCode(...uint8Array.slice(0, 4));
    let mimeType = 'image/jpeg';
    if (firstBytes.startsWith('\x89PNG')) mimeType = 'image/png';
    else if (firstBytes.startsWith('RIFF')) mimeType = 'image/webp';
    
    // Convertir a base64
    const base64 = btoa(
      uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    console.error('Error converting photo:', err);
    return null;
  }
}

/**
 * Procesa una lista de fotos para incluir en PDF
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
