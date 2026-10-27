import { useRef, useCallback, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, Check, Printer } from 'lucide-react';
import { downloadQrStickerPng } from '@/utils/qrSticker';
import { getElevatorPublicUrl } from '@/config/supabase';

interface ElevatorQRCodeProps {
  qrToken: string;
  elevatorCode: string;
  size?: number;
  showUrl?: boolean;
  allowDownload?: boolean;
  allowPrint?: boolean;
}

export default function ElevatorQRCode({
  qrToken,
  elevatorCode,
  size = 200,
  showUrl = true,
  allowDownload = true,
  allowPrint = true,
}: ElevatorQRCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qrError, setQrError] = useState('');

  const publicUrl = getElevatorPublicUrl(qrToken);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = publicUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [publicUrl]);

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    const svgElement = qrRef.current?.querySelector('svg');
    if (!svgElement) {
      setQrError('No se pudo encontrar el QR para descargarlo.');
      return;
    }

    setDownloading(true);
    setQrError('');
    try {
      // El PNG utiliza el SVG/URL pública existente: no genera otro token.
      await downloadQrStickerPng(svgElement, elevatorCode);
    } catch {
      setQrError('No se pudo generar el PNG. Probá de nuevo o utilizá Imprimir.');
    } finally {
      setDownloading(false);
    }
  }, [downloading, elevatorCode]);

  const handlePrint = useCallback(() => {
    const svgMarkup = qrRef.current?.querySelector('svg')?.outerHTML;
    if (!svgMarkup) {
      setQrError('No se pudo encontrar el QR para imprimirlo.');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setQrError('El navegador bloqueó la ventana de impresión.');
      return;
    }
    // El código puede tener caracteres especiales; nunca insertarlo en HTML sin escapar.
    const safeCode = elevatorCode.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character] || character));

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR - ${safeCode}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .qr-container {
              text-align: center;
              padding: 20px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
            }
            .elevator-code {
              font-size: 18px;
              font-weight: bold;
              margin-top: 15px;
              color: #1f2937;
            }
            .instruction {
              font-size: 12px;
              color: #6b7280;
              margin-top: 10px;
            }
            .company {
              font-size: 11px;
              color: #9ca3af;
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            ${svgMarkup}
            <div class="elevator-code">${safeCode}</div>
            <div class="instruction">Escanee para consultar estado del ascensor</div>
            <div class="company">SICOM Patagonia SRL</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, [elevatorCode]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={qrRef} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <QRCodeSVG
          value={publicUrl}
          size={size}
          level="M"
          includeMargin={false}
        />
      </div>
      
      <div className="text-center">
        <p className="font-mono font-bold text-gray-900">{elevatorCode}</p>
        {showUrl && (
          <p className="text-xs text-gray-500 mt-1 break-all max-w-[250px]">{publicUrl}</p>
        )}
      </div>

      {qrError && <p role="alert" className="text-center text-sm text-danger">{qrError}</p>}

      <div className="flex flex-wrap justify-center gap-2">
        {allowDownload && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-primary text-white hover:bg-primary-dark disabled:opacity-50 rounded-lg transition-colors"
            title="Descargar etiqueta QR en PNG de 1200 píxeles para imprimir"
          >
            <Download size={16} />
            {downloading ? 'Generando PNG...' : 'Descargar QR (PNG)'}
          </button>
        )}

        {allowPrint && (
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Printer size={14} />
            Imprimir
          </button>
        )}

        <button
          type="button"
          onClick={handleCopyUrl}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          {copied ? 'Copiado' : 'Copiar URL'}
        </button>
      </div>
    </div>
  );
}
