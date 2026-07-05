// Assets visuales de SICOM Patagonia Ascensores
// Imágenes reales en public/images/sicom/

export const SICOM_IMAGES = {
  // Hero principal
  hero: "/images/sicom/01_hero_sicom_tecnologia_ascensores.png",
  
  // Técnico y mantenimiento
  technician: "/images/sicom/02_tecnico_mantenimiento_cabina.png",
  machineRoom: "/images/sicom/03_sala_maquinas_motor_poleas.png",
  
  // Control y diagnóstico
  controlPanel: "/images/sicom/04_tablero_control_digital.png",
  qr: "/images/sicom/05_qr_estado_ascensor.png",
  
  // Servicios
  motorWork: "/images/sicom/06_operario_revisando_motor.png",
  modernCabin: "/images/sicom/07_cabina_modernizada_premium.png",
  
  // Informes
  reports: "/images/sicom/08_supervisor_informe_pdf.png",
  
  // Dashboard
  dashboard: "/images/sicom/09_dashboard_estados_mantenimiento.png",
  
  // Historial
  history: "/images/sicom/10_historial_digital_libro_interno.png",
  
  // Logos
  logo: "/logo-sicom.svg",
  logoPng: "/images/sicom/logo_original_sicom.png",
  logo512: "/images/sicom/logo_sicom_512_transparent.png",
};

// Paleta de colores SICOM
export const SICOM_COLORS = {
  navy: "#06172E",
  blue: "#0B5C8F",
  cyan: "#17B3E2",
  green: "#8DB600",
  white: "#FFFFFF",
};

// Servicios para展示
export const SICOM_SERVICES = [
  {
    title: "Mantenimiento preventivo",
    description: "Intervenciones registradas por técnico, checklist y seguimiento por supervisor.",
    image: SICOM_IMAGES.technician,
  },
  {
    title: "Reparación y asistencia técnica",
    description: "Operarios de campo con respaldo digital, fotos y registros de cada intervención.",
    image: SICOM_IMAGES.motorWork,
  },
  {
    title: "Modernización de ascensores",
    description: "Tecnología, seguridad y mejora continua en cada componente.",
    image: SICOM_IMAGES.modernCabin,
  },
  {
    title: "Informes y trazabilidad digital",
    description: "IA asistida, revisión humana, PDF profesional y envío a destinatarios autorizados.",
    image: SICOM_IMAGES.reports,
  },
];

// Galería visual
export const SICOM_GALLERY = [
  {
    title: "Sala de máquinas",
    description: "Motores, poleas, frenos y componentes críticos.",
    image: SICOM_IMAGES.machineRoom,
  },
  {
    title: "Servicio técnico",
    description: "Operarios de campo con respaldo digital.",
    image: SICOM_IMAGES.technician,
  },
  {
    title: "Cabinas modernizadas",
    description: "Tecnología y seguridad en cada cabina.",
    image: SICOM_IMAGES.modernCabin,
  },
  {
    title: "Control documental",
    description: "Trazabilidad completa de cada intervención.",
    image: SICOM_IMAGES.reports,
  },
];
