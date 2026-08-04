import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ServiceRecordPDF from './ServiceRecordPDF';

vi.mock('@react-pdf/renderer', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    Document: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
    Page: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
    Text: ({ children }: { children?: React.ReactNode }) => React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
    Image: 'img',
    StyleSheet: { create: (s: unknown) => s },
  };
});

vi.mock('@/assets/logo-sicom.png', () => ({ default: 'logo-sicom.png' }));

afterEach(() => {
  cleanup();
});

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    service_date: '2026-08-03',
    service_type: 'preventivo',
    operational_status_at_service: 'operativo',
    conservation_status_at_service: 'conforme',
    description: 'Mantenimiento preventivo',
    observations: undefined,
    technical_report: undefined,
    final_report_text: 'Informe técnico del mantenimiento preventivo.',
    status: 'approved',
    approved_at: '2026-08-03T15:00:00Z',
    ...overrides,
  };
}

function makeElevator(overrides: Record<string, unknown> = {}) {
  return {
    code: 'ASC-0001',
    manufacturer: 'Otis',
    model: 'Gen2',
    elevator_type: 'traccion',
    building: {
      name: 'Edificio Central',
      address: 'Av. Libertador 1234',
      locality: 'Comodoro Rivadavia',
      province: 'Chubut',
      client: { name: 'Cliente ABC' },
    },
    ...overrides,
  };
}

function renderPdf(overrides: Record<string, unknown> = {}) {
  return render(
    <ServiceRecordPDF
      record={makeRecord(overrides.record as Record<string, unknown>)}
      elevator={makeElevator(overrides.elevator as Record<string, unknown>)}
      technician={overrides.technician as { full_name: string } ?? { full_name: 'Juan Técnico' }}
      approvedBy={overrides.approvedBy as { full_name: string } ?? { full_name: 'Lucas Forquera' }}
      checklist={overrides.checklist as Array<{ item_name: string; status: string; notes?: string }> ?? [
        { item_name: 'Estado de puertas', status: 'ok', notes: 'Sin observaciones' },
        { item_name: 'Limpieza general', status: 'ok', notes: 'Limpieza realizada' },
      ]}
    />,
  );
}

describe('ServiceRecordPDF — Contenido base', () => {
  it('título Informe Técnico de Mantenimiento', () => {
    renderPdf();
    expect(screen.getAllByText('INFORME TÉCNICO DE MANTENIMIENTO').length).toBeGreaterThanOrEqual(1);
  });

  it('cliente', () => {
    renderPdf();
    expect(screen.getAllByText('Cliente ABC').length).toBeGreaterThanOrEqual(1);
  });

  it('edificio', () => {
    renderPdf();
    expect(screen.getAllByText('Edificio Central').length).toBeGreaterThanOrEqual(1);
  });

  it('código ASC-0001', () => {
    renderPdf();
    expect(screen.getAllByText('ASC-0001').length).toBeGreaterThanOrEqual(1);
  });

  it('fecha 3/8/2026', () => {
    renderPdf();
    expect(screen.getAllByText('3/8/2026').length).toBeGreaterThanOrEqual(1);
  });

  it('operativo', () => {
    renderPdf();
    expect(screen.getAllByText('Operativo').length).toBeGreaterThanOrEqual(1);
  });

  it('conforme', () => {
    renderPdf();
    expect(screen.getAllByText('Conforme').length).toBeGreaterThanOrEqual(1);
  });
});

describe('ServiceRecordPDF — Checklist', () => {
  it('checklist completo', () => {
    renderPdf();
    expect(screen.getAllByText('Estado de puertas').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Limpieza general').length).toBeGreaterThanOrEqual(1);
  });

  it('traducción OK', () => {
    renderPdf();
    expect(screen.getAllByText('OK').length).toBeGreaterThanOrEqual(1);
  });

  it('nota de limpieza', () => {
    renderPdf();
    expect(screen.getAllByText('Limpieza realizada').length).toBeGreaterThanOrEqual(1);
  });
});

describe('ServiceRecordPDF — Footer aprobado', () => {
  it('estado APROBADO', () => {
    renderPdf();
    expect(screen.getAllByText('Estado: APROBADO').length).toBeGreaterThanOrEqual(1);
  });

  it('fecha de aprobación argentina', () => {
    renderPdf();
    expect(screen.getAllByText(/Fecha de aprobación:/).length).toBeGreaterThanOrEqual(1);
  });

  it('"Aprobado por: Lucas Forquera"', () => {
    renderPdf();
    expect(screen.getAllByText('Aprobado por: Lucas Forquera').length).toBeGreaterThanOrEqual(1);
  });

  it('no muestra "Administrador" si existe perfil', () => {
    renderPdf({ approvedBy: { full_name: 'Lucas Forquera' } });
    const body = document.body.textContent || '';
    expect(body).not.toMatch(/Aprobado por:.*Administrador/);
  });
});
