/**
 * Producción local (sin servidores externos) de una etiqueta QR lista para imprimir.
 * El SVG procede del mismo QR mostrado en pantalla y conserva su URL pública.
 *
 * 1200 píxeles de ancho ofrecen ~305 píxeles/pulgada para un ancho de 10 cm.
 * El tamaño físico debe configurarse en la aplicación de impresión.
 */
export const QR_STICKER_WIDTH = 1200;
export const QR_STICKER_HEIGHT = 1440;
export const QR_STICKER_SYMBOL_SIZE = 1020;
export const QR_STICKER_SYMBOL_MARGIN = 90;

export function qrStickerFileName(elevatorCode: string): string {
  const clean = elevatorCode
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'ascensor';

  return `SICOM_QR_${clean}.png`;
}

export async function renderQrStickerPng(
  qrSvg: SVGSVGElement,
  elevatorCode: string,
): Promise<Blob> {
  // Escalar el SVG antes de rasterizarlo para conservar el detalle del QR.
  // Nunca modificar el nodo original ni su valor público.
  const exportSvg = qrSvg.cloneNode(true) as SVGSVGElement;
  exportSvg.setAttribute('width', String(QR_STICKER_SYMBOL_SIZE));
  exportSvg.setAttribute('height', String(QR_STICKER_SYMBOL_SIZE));
  const svgString = new XMLSerializer().serializeToString(exportSvg);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar el código QR para exportarlo.'));
    img.src = svgDataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = QR_STICKER_WIDTH;
  canvas.height = QR_STICKER_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tu navegador no permite generar la imagen PNG.');

  // Fondo blanco y margen libre alrededor del QR (quiet zone para el escáner).
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, QR_STICKER_WIDTH, QR_STICKER_HEIGHT);
  context.imageSmoothingEnabled = false;
  context.drawImage(
    image,
    QR_STICKER_SYMBOL_MARGIN,
    QR_STICKER_SYMBOL_MARGIN,
    QR_STICKER_SYMBOL_SIZE,
    QR_STICKER_SYMBOL_SIZE,
  );

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#111827';
  context.font = 'bold 62px Arial, Helvetica, sans-serif';
  context.fillText(elevatorCode, QR_STICKER_WIDTH / 2, 1195, 1100);

  context.fillStyle = '#374151';
  context.font = '32px Arial, Helvetica, sans-serif';
  context.fillText('Escaneá para consultar el estado', QR_STICKER_WIDTH / 2, 1290, 1100);
  context.font = '28px Arial, Helvetica, sans-serif';
  context.fillText('SICOM Patagonia SRL', QR_STICKER_WIDTH / 2, 1348, 1100);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo crear el archivo PNG.'));
      },
      'image/png',
    );
  });
}

export async function downloadQrStickerPng(qrSvg: SVGSVGElement, elevatorCode: string): Promise<void> {
  const png = await renderQrStickerPng(qrSvg, elevatorCode);
  const objectUrl = URL.createObjectURL(png);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = qrStickerFileName(elevatorCode);
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // El navegador necesita tiempo para iniciar la descarga.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  }
}
