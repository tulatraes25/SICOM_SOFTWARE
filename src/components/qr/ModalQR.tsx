import { X } from 'lucide-react';
import ElevatorQRCode from './ElevatorQRCode';

interface ModalQRProps {
  elevatorCode: string;
  qrToken: string;
  onClose: () => void;
}

export default function ModalQR({ elevatorCode, qrToken, onClose }: ModalQRProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`QR para imprimir del ascensor ${elevatorCode}`}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-4 sm:p-6 relative max-h-[calc(100vh-2rem)] overflow-y-auto">
        <button
          type="button"
          aria-label="Cerrar ventana QR"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
          Descargar QR del ascensor
        </h3>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Descargá la imagen PNG y usala para imprimir una etiqueta para pegar en el ascensor.
        </p>

        <ElevatorQRCode
          qrToken={qrToken}
          elevatorCode={elevatorCode}
          size={200}
          showUrl={true}
          allowDownload={true}
          allowPrint={true}
        />
        <p className="text-xs text-center text-gray-500 mt-4">
          PNG de alta resolución (1200 px). Para una etiqueta nítida, imprimí a 8–10 cm de ancho,
          sin recortar el margen blanco, y verificá que el QR se pueda escanear antes de colocarlo.
        </p>
      </div>
    </div>
  );
}
