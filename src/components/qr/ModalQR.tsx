import { X } from 'lucide-react';
import ElevatorQRCode from './ElevatorQRCode';

interface ModalQRProps {
  elevatorCode: string;
  qrToken: string;
  onClose: () => void;
}

export default function ModalQR({ elevatorCode, qrToken, onClose }: ModalQRProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
          Código QR del Ascensor
        </h3>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Escanee para consultar el estado del ascensor
        </p>

        <ElevatorQRCode
          qrToken={qrToken}
          elevatorCode={elevatorCode}
          size={200}
          showUrl={true}
          allowDownload={true}
          allowPrint={true}
        />
      </div>
    </div>
  );
}
