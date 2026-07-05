import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicElevatorByToken, logQRScan } from '@/services/publicElevator.service';
import {
  OPERATIONAL_STATUS_LABELS,
  CONSERVATION_STATUS_LABELS,
  STATUS_COLORS,
} from '@/types/elevators';
import { COMPANY_NAME, COMPANY_SLOGAN, COMPANY_WEBSITE, COMPANY_PHONE, COMPANY_EMAIL, COMPANY_ADDRESS } from '@/config/constants';
import { SICOM_IMAGES, SICOM_SERVICES, SICOM_GALLERY } from '@/config/assets';
import Badge from '@/components/ui/Badge';
import { ArrowRight, ExternalLink, CheckCircle, Wrench, BarChart3, FileText, Building2, Clock, Phone, Mail } from 'lucide-react';

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
  building?: {
    name: string;
    address: string;
    locality: string;
    province: string;
  };
  client?: {
    name: string;
  };
}

const serviceIcons = [Wrench, Wrench, BarChart3, FileText];

export default function PublicElevatorView() {
  const { token } = useParams<{ token: string }>();
  const [showIntro, setShowIntro] = useState(true);
  const [elevator, setElevator] = useState<PublicElevatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Token no proporcionado');
      setLoading(false);
      return;
    }
    loadElevator();
  }, [token]);

  const loadElevator = async () => {
    try {
      setLoading(true);
      const data = await getPublicElevatorByToken(token!);
      
      if (!data) {
        setError('Código QR no encontrado o ascensor no disponible.');
        return;
      }

      setElevator(data);
      await logQRScan(token!, data.id);
    } catch (err) {
      setError('Error al cargar la información del ascensor.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    setShowIntro(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-sicom-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/80">Cargando información...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !elevator) {
    return (
      <div className="min-h-screen bg-sicom-gradient flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <img src={SICOM_IMAGES.logo} alt={COMPANY_NAME} className="h-16 mx-auto mb-6" />
          <div className="w-16 h-16 bg-danger/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Ascensor no encontrado</h1>
          <p className="text-white/70 mb-6">{error}</p>
          <a 
            href={COMPANY_WEBSITE} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-6 py-3 rounded-xl hover:bg-accent-light transition-colors"
          >
            Visitar sitio web
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    );
  }

  // Intro screen
  if (showIntro) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${SICOM_IMAGES.hero})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-accent/70" />
        </div>
        
        {/* Content */}
        <div className="relative min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-2xl">
            <img src={SICOM_IMAGES.logo} alt={COMPANY_NAME} className="h-20 mx-auto mb-8" />
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {COMPANY_NAME}
            </h1>
            
            <p className="text-xl text-white/90 mb-6 leading-relaxed">
              {COMPANY_SLOGAN}
            </p>
            
            <p className="text-white/70 mb-10 text-lg">
              Comodoro Rivadavia y Patagonia.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleContinue}
                className="inline-flex items-center justify-center gap-2 bg-secondary text-white font-semibold px-8 py-4 rounded-xl hover:bg-secondary-dark transition-all transform hover:scale-105 shadow-lg"
              >
                Consultar estado del ascensor
                <ArrowRight size={20} />
              </button>
              
              <a
                href={COMPANY_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/20 transition-all border border-white/30"
              >
                Conocer servicios
                <ExternalLink size={18} />
              </a>
            </div>

            <div className="mt-12 pt-8 border-t border-white/20">
              <a 
                href={COMPANY_WEBSITE} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              >
                <ExternalLink size={14} />
                {COMPANY_WEBSITE}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main view - elevator info
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <img src={SICOM_IMAGES.logo} alt={COMPANY_NAME} className="h-10" />
          <a 
            href={COMPANY_WEBSITE} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-600 hover:text-secondary transition-colors text-sm"
          >
            Visitar sitio web
            <ExternalLink size={14} />
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Elevator code card */}
        <div className="bg-sicom-gradient rounded-2xl shadow-lg p-8 text-center text-white">
          <p className="text-white/70 mb-2">Estado del ascensor</p>
          <h2 className="text-4xl font-bold font-mono mb-2">{elevator.code}</h2>
          {elevator.manufacturer && (
            <p className="text-white/80">
              {elevator.manufacturer} {elevator.model && `- ${elevator.model}`}
            </p>
          )}
        </div>

        {/* Location */}
        {elevator.building && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <Building2 size={20} className="text-accent" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-lg">{elevator.building.name}</p>
                <p className="text-gray-600">{elevator.building.address}</p>
                <p className="text-gray-500">
                  {elevator.building.locality}, {elevator.building.province}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Operational status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-2">Estado Operativo</p>
                <Badge className={`${STATUS_COLORS[elevator.operational_status] || ''} text-sm px-3 py-1`}>
                  {OPERATIONAL_STATUS_LABELS[elevator.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || elevator.operational_status}
                </Badge>
              </div>
              <div className="w-14 h-14 bg-success/10 rounded-xl flex items-center justify-center">
                <CheckCircle size={28} className="text-success" />
              </div>
            </div>
          </div>

          {/* Conservation status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-2">Estado de Conservación</p>
                <Badge className={`${STATUS_COLORS[elevator.conservation_status] || ''} text-sm px-3 py-1`}>
                  {CONSERVATION_STATUS_LABELS[elevator.conservation_status as keyof typeof CONSERVATION_STATUS_LABELS] || elevator.conservation_status}
                </Badge>
              </div>
              <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center">
                <Wrench size={28} className="text-accent" />
              </div>
            </div>
          </div>
        </div>

        {/* Service info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-secondary" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Último mantenimiento registrado</p>
              <p className="font-semibold text-gray-900">
                {elevator.last_service_date 
                  ? new Date(elevator.last_service_date).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })
                  : 'Sin registros de mantenimiento aprobados.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Company info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4 mb-4">
            <img src={SICOM_IMAGES.logo} alt={COMPANY_NAME} className="h-8" />
            <div>
              <p className="font-semibold text-gray-900">{COMPANY_NAME}</p>
              <p className="text-sm text-gray-500">Empresa conservadora</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Phone size={16} className="text-secondary" />
              {COMPANY_PHONE}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Mail size={16} className="text-secondary" />
              {COMPANY_EMAIL}
            </div>
          </div>
        </div>

        {/* Services section */}
        <div className="mt-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Servicios de {COMPANY_NAME}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SICOM_SERVICES.map((service, index) => {
              const Icon = serviceIcons[index];
              return (
                <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-40 bg-sicom-gradient relative overflow-hidden">
                    <img 
                      src={service.image} 
                      alt={service.title}
                      className="w-full h-full object-cover opacity-80"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                        <Icon size={20} className="text-secondary" />
                      </div>
                      <h4 className="font-semibold text-gray-900">{service.title}</h4>
                    </div>
                    <p className="text-gray-600 text-sm">{service.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gallery */}
        <div className="mt-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Galería
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SICOM_GALLERY.map((item, index) => (
              <div key={index} className="relative group overflow-hidden rounded-xl aspect-square">
                <img 
                  src={item.image} 
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-semibold text-sm">{item.title}</p>
                    <p className="text-white/70 text-xs">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-12 mt-12 border-t border-gray-200">
          <img src={SICOM_IMAGES.logo} alt={COMPANY_NAME} className="h-12 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">{COMPANY_NAME}</p>
          <p className="text-gray-500 text-sm mt-1">{COMPANY_ADDRESS}</p>
          <a 
            href={COMPANY_WEBSITE} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 text-secondary hover:text-secondary-dark transition-colors"
          >
            <ExternalLink size={14} />
            {COMPANY_WEBSITE}
          </a>
        </footer>
      </main>
    </div>
  );
}
