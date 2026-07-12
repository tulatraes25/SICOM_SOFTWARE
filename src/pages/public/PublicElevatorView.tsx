import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicElevatorByToken, logQRScan, getPublicServiceHistory } from '@/services/publicElevator.service';
import type { PublicServiceHistory } from '@/services/publicElevator.service';
import { OPERATIONAL_STATUS_LABELS, CONSERVATION_STATUS_LABELS } from '@/types/elevators';
import { COMPANY_NAME, COMPANY_SLOGAN, COMPANY_WEBSITE, COMPANY_PHONE, COMPANY_EMAIL, COMPANY_ADDRESS } from '@/config/constants';
import Badge from '@/components/ui/Badge';
import { ArrowRight, ExternalLink, CheckCircle, Wrench, MapPin, Clock, Phone, Mail, AlertCircle, FileText } from 'lucide-react';

interface PublicElevatorData {
  id: string;
  code: string;
  manufacturer?: string;
  model?: string;
  elevator_type?: string;
  operational_status: string;
  conservation_status: string;
  contractual_status: string;
  last_service_date?: string;
  updated_at: string;
  building?: { name: string; address: string; locality: string; province: string; };
}

function getStatusLabel(status: string, labels: Record<string, string>): string {
  return labels[status] || status || 'No informado';
}

function getStatusBadgeClass(status: string): string {
  if (['operativo', 'conforme'].includes(status)) return 'bg-success/15 text-success border-success/30';
  if (['operativo_con_observaciones', 'observado', 'pendiente_de_verificacion'].includes(status)) return 'bg-warning/15 text-warning border-warning/30';
  return 'bg-danger/15 text-danger border-danger/30';
}

export default function PublicElevatorView() {
  const { token } = useParams<{ token: string }>();
  const [showIntro, setShowIntro] = useState(true);
  const [elevator, setElevator] = useState<PublicElevatorData | null>(null);
  const [history, setHistory] = useState<PublicServiceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setError('Token no proporcionado'); setLoading(false); return; }
    loadElevator();
  }, [token]);

  const loadElevator = async () => {
    try {
      setLoading(true);
      const data = await getPublicElevatorByToken(token!);
      if (!data) { setError('No se encontró un ascensor asociado a este código QR.'); return; }
      setElevator(data);
      await logQRScan(token!, data.id);
      // Cargar historial
      const historyData = await getPublicServiceHistory(data.id);
      setHistory(historyData);
    } catch { setError('Error al cargar la información del ascensor.'); }
    finally { setLoading(false); }
  };

  // Loading
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary-dark flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/80">Cargando...</p>
      </div>
    </div>
  );

  // Error
  if (error || !elevator) return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary-dark flex items-center justify-center p-4">
      <div className="text-center max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
        <img src="/images/sicom/logo_original_sicom.png" alt={COMPANY_NAME} className="h-16 mx-auto mb-6 object-contain" />
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Ascensor no encontrado</h1>
        <p className="text-white/70 mb-6">{error}</p>
        <a href={COMPANY_WEBSITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white/20 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/30 transition-colors">
          Visitar sitio web <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );

  // Intro
  if (showIntro) return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary-dark flex items-center justify-center p-4">
      <div className="text-center max-w-lg">
        <div className="rounded-2xl bg-white px-8 py-6 shadow-lg mx-auto mb-8 inline-block">
          <img src="/images/sicom/logo_original_sicom.png" alt={COMPANY_NAME} className="h-auto w-full max-w-[280px] object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">SICOM Patagonia SRL</h1>
        <p className="text-white/90 text-lg mb-4 leading-relaxed">{COMPANY_SLOGAN}</p>
        <p className="text-white/70 mb-8">Comodoro Rivadavia y Patagonia.</p>
        <button onClick={() => setShowIntro(false)} className="inline-flex items-center gap-2 bg-secondary text-white font-semibold px-8 py-4 rounded-xl hover:bg-secondary-dark transition-all transform hover:scale-105 shadow-lg">
          Ver estado del ascensor <ArrowRight size={20} />
        </button>
        <div className="mt-8 pt-6 border-t border-white/20">
          <a href={COMPANY_WEBSITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
            <ExternalLink size={14} /> {COMPANY_WEBSITE}
          </a>
        </div>
      </div>
    </div>
  );

  // Main view
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 py-4 px-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <img src="/images/sicom/logo_original_sicom.png" alt={COMPANY_NAME} className="h-10 object-contain" />
          <a href={COMPANY_WEBSITE} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-secondary transition-colors">
            <ExternalLink size={18} />
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Ascensor code */}
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl shadow-lg p-6 text-center text-white">
          <p className="text-white/70 mb-1">Estado del ascensor</p>
          <h2 className="text-3xl font-bold font-mono">{elevator.code}</h2>
          {elevator.manufacturer && <p className="text-white/80 text-sm mt-1">{elevator.manufacturer} {elevator.model}</p>}
        </div>

        {/* Location */}
        {elevator.building && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-start gap-3">
              <MapPin size={20} className="text-secondary mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{elevator.building.name}</p>
                <p className="text-sm text-gray-600">{elevator.building.address}</p>
                <p className="text-sm text-gray-500">{elevator.building.locality}, {elevator.building.province}</p>
              </div>
            </div>
          </div>
        )}

        {/* Status cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm text-gray-500 mb-2">Estado Operativo</p>
            <Badge className={`${getStatusBadgeClass(elevator.operational_status)} text-sm px-3 py-1`}>
              {getStatusLabel(elevator.operational_status, OPERATIONAL_STATUS_LABELS)}
            </Badge>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm text-gray-500 mb-2">Estado de Conservación</p>
            <Badge className={`${getStatusBadgeClass(elevator.conservation_status)} text-sm px-3 py-1`}>
              {getStatusLabel(elevator.conservation_status, CONSERVATION_STATUS_LABELS)}
            </Badge>
          </div>
        </div>

        {/* Last service */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-secondary" />
            <div>
              <p className="text-sm text-gray-500">Último mantenimiento</p>
              <p className="font-medium text-gray-900">
                {elevator.last_service_date
                  ? new Date(elevator.last_service_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
                  : 'Sin mantenimientos aprobados registrados para este equipo.'}
              </p>
            </div>
          </div>
        </div>

        {/* HISTORIAL RECIENTE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-secondary" />
            Historial Reciente
          </h3>
          {history.length > 0 ? (
            <div className="space-y-4">
              {history.map((item, index) => (
                <div key={index} className={`${index < history.length - 1 ? 'border-b border-gray-100 pb-4' : ''}`}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Fecha</p>
                      <p className="font-medium text-gray-900">
                        {new Date(item.service_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Tipo</p>
                      <p className="font-medium text-gray-900 capitalize">{item.service_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Estado Operativo</p>
                      <Badge className={`${getStatusBadgeClass(item.operational_status)} text-xs`}>
                        {getStatusLabel(item.operational_status, OPERATIONAL_STATUS_LABELS)}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Conservación</p>
                      <Badge className={`${getStatusBadgeClass(item.conservation_status)} text-xs`}>
                        {getStatusLabel(item.conservation_status, CONSERVATION_STATUS_LABELS)}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Este ascensor aún no posee historial de mantenimientos.</p>
          )}
        </div>

        {/* Company info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-3">
            <img src="/images/sicom/logo_original_sicom.png" alt={COMPANY_NAME} className="h-12 w-auto object-contain" />
            <div>
              <p className="font-medium text-gray-900 text-sm">{COMPANY_NAME}</p>
              <p className="text-xs text-gray-500">Empresa conservadora</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Phone size={14} className="text-secondary" /> {COMPANY_PHONE}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Mail size={14} className="text-secondary" /> {COMPANY_EMAIL}
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Servicios de {COMPANY_NAME}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Mantenimiento preventivo', icon: Wrench, desc: 'Intervenciones programadas y checklist de verificación.' },
              { title: 'Reparación y asistencia', icon: Wrench, desc: 'Operarios de campo con respaldo digital.' },
              { title: 'Modernización', icon: CheckCircle, desc: 'Tecnología y seguridad en cada componente.' },
              { title: 'Informes y trazabilidad', icon: FileText, desc: 'PDF profesional y envío a destinatarios.' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <s.icon size={16} className="text-secondary" />
                  </div>
                  <h4 className="font-medium text-gray-900 text-sm">{s.title}</h4>
                </div>
                <p className="text-gray-600 text-xs">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-8 mt-4 border-t border-gray-200">
          <img src="/images/sicom/logo_original_sicom.png" alt={COMPANY_NAME} className="h-12 mx-auto mb-3 object-contain" />
          <p className="text-gray-600 text-sm font-medium">{COMPANY_NAME}</p>
          <p className="text-gray-500 text-xs">{COMPANY_ADDRESS}</p>
          <a href={COMPANY_WEBSITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-secondary hover:text-secondary-dark transition-colors text-xs">
            <ExternalLink size={12} /> {COMPANY_WEBSITE}
          </a>
        </footer>
      </main>
    </div>
  );
}