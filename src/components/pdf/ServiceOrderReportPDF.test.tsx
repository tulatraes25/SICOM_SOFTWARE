import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ServiceOrderReportPDF from './ServiceOrderReportPDF';

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

afterEach(() => { cleanup(); });

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    status: 'approved',
    subject: 'Asunto test',
    priority: 'normal',
    order_type: 'other',
    order_date: '2026-01-15',
    work_requested: 'Trabajo solicitado test',
    completion_summary: null,
    reviewer_notes: null,
    scheduled_date: null,
    scheduled_time: null,
    started_at: null,
    completed_at: null,
    reviewed_at: null,
    service_case: { case_number: 100, numbering_mode: 'production' },
    client: { name: 'Cliente 1' },
    building: { name: 'Edificio 1', address: 'Av. Principal 123' },
    elevator: { code: 'ASC-001' },
    technicians: [],
    ...overrides,
  };
}

function renderPdf(overrides: Record<string, unknown> = {}, extraProps: Record<string, unknown> = {}) {
  return render(
    <ServiceOrderReportPDF
      order={makeOrder(overrides)}
      progress={[]}
      events={[]}
      isTest={false}
      {...extraProps}
    />
  );
}

describe('ServiceOrderReportPDF — Contenido base', () => {
  it('muestra ORDEN DE SERVICIO', () => {
    renderPdf();
    expect(screen.getAllByText('ORDEN DE SERVICIO').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra número público', () => {
    renderPdf();
    expect(screen.getAllByText(/N.º\s*100/).length).toBeGreaterThanOrEqual(1);
  });

  it('muestra cliente', () => {
    renderPdf();
    expect(screen.getAllByText('Cliente 1').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra edificio', () => {
    renderPdf();
    expect(screen.getAllByText('Edificio 1').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra dirección', () => {
    renderPdf();
    expect(screen.getAllByText('Av. Principal 123').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra ascensor', () => {
    renderPdf();
    expect(screen.getAllByText('ASC-001').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra trabajo solicitado', () => {
    renderPdf();
    expect(screen.getAllByText('Trabajo solicitado test').length).toBeGreaterThanOrEqual(1);
  });
});

describe('ServiceOrderReportPDF — Trabajo Realizado', () => {
  it('muestra Trabajo Realizado y Resultado', () => {
    renderPdf({ completion_summary: 'Se realizó el mantenimiento' });
    expect(screen.getAllByText('Se realizó el mantenimiento').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra completion_summary', () => {
    renderPdf({ completion_summary: 'Trabajo completado con éxito' });
    expect(screen.getAllByText('Trabajo completado con éxito').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra No informado cuando no hay completion_summary', () => {
    renderPdf({ completion_summary: null });
    expect(screen.getAllByText('No informado').length).toBeGreaterThanOrEqual(1);
  });
});

describe('ServiceOrderReportPDF — Técnicos', () => {
  it('muestra técnicos', () => {
    renderPdf({
      technicians: [
        { technician: { id: 't1', full_name: 'Juan Pérez' }, is_lead: false },
        { technician: { id: 't2', full_name: 'María García' }, is_lead: true },
      ],
    });
    expect(screen.getAllByText(/Juan Pérez/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/María García/).length).toBeGreaterThanOrEqual(1);
  });

  it('identifica al principal', () => {
    renderPdf({
      technicians: [
        { technician: { id: 't1', full_name: 'Juan Pérez' }, is_lead: false },
        { technician: { id: 't2', full_name: 'María García' }, is_lead: true },
      ],
    });
    expect(screen.getAllByText(/María García — Principal/).length).toBeGreaterThanOrEqual(1);
  });
});

describe('ServiceOrderReportPDF — Observaciones del revisor', () => {
  it('muestra observaciones del revisor', () => {
    renderPdf({ reviewer_notes: 'Revisado y aprobado' });
    expect(screen.getAllByText('Revisado y aprobado').length).toBeGreaterThanOrEqual(1);
  });
});

describe('ServiceOrderReportPDF — PRUEBA banner', () => {
  it('muestra banner PRUEBA cuando numbering_mode = test', () => {
    renderPdf({}, { isTest: true });
    expect(screen.getAllByText(/DOCUMENTO DE PRUEBA/).length).toBeGreaterThanOrEqual(1);
  });

  it('muestra PRUEBA N.º cuando numbering_mode = test', () => {
    renderPdf({}, { isTest: true });
    expect(screen.getAllByText(/PRUEBA N.º\s*100/).length).toBeGreaterThanOrEqual(1);
  });
});

describe('ServiceOrderReportPDF — UUID', () => {
  it('no muestra UUID', () => {
    renderPdf();
    const body = document.body.textContent || '';
    expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });
});

describe('ServiceOrderReportPDF — Relaciones opcionales', () => {
  it('renderiza sin excepción con relaciones opcionales ausentes', () => {
    expect(() => {
      render(
        <ServiceOrderReportPDF
          order={makeOrder({
            client: null,
            building: null,
            elevator: null,
            service_case: null,
            technicians: null,
          })}
          progress={[]}
          events={[]}
          isTest={false}
        />
      );
    }).not.toThrow();
  });
});
