import { useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, Check, Printer } from 'lucide-react';
import { useState } from 'react';
import { appConfig } from '@/config/supabase';

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

  const publicUrl = `${appConfig.publicUrl}/${qrToken}`;

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

  const handleDownload = useCallback(() => {
    const svgElement = qrRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = size + 60;
      canvas.height = size + 100;
      
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // QR code
      ctx.drawImage(img, 30, 10, size, size);
      
      // Text
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(elevatorCode, canvas.width / 2, size + 35);
      
      ctx.font = '10px Arial';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('Escanee para consultar estado', canvas.width / 2, size + 55);
      ctx.fillText('SICOM Patagonia SRL', canvas.width / 2, size + 70);

      const link = document.createElement('a');
      link.download = `SICOM_QR_${elevatorCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [size, elevatorCode]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR - ${elevatorCode}</title>
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
            ${qrRef.current?.querySelector('svg')?.outerHTML || ''}
            <div class="elevator-code">${elevatorCode}</div>
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

      <div className="flex gap-2">
        <button
          onClick={handleCopyUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          {copied ? 'Copiado' : 'Copiar URL'}
        </button>
        
        {allowDownload && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white hover:bg-primary-dark rounded-lg transition-colors"
          >
            <Download size={14} />
            Descargar PNG
          </button>
        )}

        {allowPrint && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Printer size={14} />
            Imprimir
          </button>
        )}
      </div>
    </div>
  );
}
