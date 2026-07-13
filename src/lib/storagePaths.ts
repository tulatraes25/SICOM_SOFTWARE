/**
 * Helpers para rutas de Storage de fotos de mantenimiento.
 * 
 * Estructura definitiva:
 * service-records/{serviceRecordId}/{uuid}.{extension}
 */

const BUCKET_NAME = 'service-photos';

/**
 * Genera el path seguro para una foto de mantenimiento.
 * @param serviceRecordId - UUID del service_record
 * @param extension - extensión del archivo (jpg, png, webp)
 * @returns path dentro del bucket
 */
export function buildServicePhotoPath(serviceRecordId: string, extension: string): string {
  const uuid = crypto.randomUUID();
  return `service-records/${serviceRecordId}/${uuid}.${extension}`;
}

/**
 * Valida que un path pertenezca al bucket correcto
 */
export function isValidServicePhotoPath(path: string): boolean {
  return path.startsWith('service-records/');
}

/**
 * Extrae el service_record_id de un path
 */
export function extractServiceRecordId(path: string): string | null {
  const parts = path.split('/');
  if (parts.length >= 2 && parts[0] === 'service-records') {
    return parts[1];
  }
  return null;
}

export { BUCKET_NAME };
