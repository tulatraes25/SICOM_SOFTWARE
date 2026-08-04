import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MonthlyReportPDF from './MonthlyReportPDF';

vi.mock('@react-pdf/renderer', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    Document: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
    Page: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
    Text: ({ children }: { children?: React.ReactNode }) => React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
    Image: ({ src }: { src: string }) => React.createElement('img', { src }),
    StyleSheet: { create: (s: unknown) => s },
  };
});

vi.mock('@/assets/logo-sicom.png', () => ({ default: 'logo-sicom.png' }));

afterEach(() => { cleanup(); });

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    report_month: 7,
    report_year: 2026,
    pdf_version: 3,
    general_status: 'operativo',
    general_notes: '',
    numbering_mode: 'production',
    elevator: {
      code: 'ASC-001',
      building: {
        name: 'Edificio Central',
        address: 'Av. Libertador 1234',
        client: { name: 'Cliente ABC' },
      },
    },
    ...overrides,
  };
}

function renderPdf(overrides: Record<string, unknown> = {}) {
  const report = overrides.report as Record<string, unknown> | undefined;
  const rest = { ...overrides };
  delete rest.report;

  return render(
    <MonthlyReportPDF
      report={report ?? makeReport()}
      maintenances={(rest.maintenances as Array<Record<string, unknown>>) ?? []}
      serviceOrders={(rest.serviceOrders as Array<Record<string, unknown>>) ?? []}
      claims={(rest.claims as Array<Record<string, unknown>>) ?? []}
      summary={(rest.summary as Record<string, unknown>) ?? { preventiveCount: 2, correctiveCount: 1, serviceOrderCount: 3, claimCount: 1, totalApproved: 4, totalWithCorrections: 1, firstDate: '2026-07-01', lastDate: '2026-07-31' }}
      signatureUrl={rest.signatureUrl as string | undefined}
      signerName={rest.signerName as string | undefined}
      isTestDocument={rest.isTestDocument as boolean | undefined}
      documentStatus={rest.documentStatus as 'preliminary' | 'approved' | undefined}
      approvedAt={rest.approvedAt as string | undefined}
    />,
  );
}

describe('MonthlyReportPDF — Contenido base', () => {
  it('período', () => {
    renderPdf();
    expect(screen.getAllByText(/Julio 2026/).length).toBeGreaterThanOrEqual(1);
  });

  it('ascensor', () => {
    renderPdf();
    expect(screen.getAllByText('ASC-001').length).toBeGreaterThanOrEqual(1);
  });

  it('cliente', () => {
    renderPdf();
    expect(screen.getAllByText('Cliente ABC').length).toBeGreaterThanOrEqual(1);
  });

  it('edificio', () => {
    renderPdf();
    expect(screen.getAllByText('Edificio Central').length).toBeGreaterThanOrEqual(1);
  });

  it('resumen', () => {
    renderPdf();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);
  });

  it('mantenimientos', () => {
    renderPdf({
      maintenances: [
        { service_type: 'preventivo', status: 'approved', service_date: '2026-07-05', technician: { full_name: 'Juan Técnico' }, description: 'Mantenimiento preventivo trimestral' },
      ],
    });
    expect(screen.getAllByText(/Mantenimientos Realizados/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Juan Técnico').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Mantenimiento preventivo trimestral').length).toBeGreaterThanOrEqual(1);
  });

  it('órdenes', () => {
    renderPdf({
      serviceOrders: [
        { service_case: { case_number: 101, numbering_mode: 'production' }, status: 'approved', order_date: '2026-07-10', order_type: 'correctivo', priority: 'high', work_requested: 'Reparación de puerta' },
      ],
    });
    expect(screen.getAllByText(/Órdenes de Servicio/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/N.º\s*101/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Reparación de puerta').length).toBeGreaterThanOrEqual(1);
  });

  it('reclamos', () => {
    renderPdf({
      claims: [
        { service_case: { case_number: 201, numbering_mode: 'production' }, status: 'in_progress', claim_date: '2026-07-15', subject: 'Ruido en cabina' },
      ],
    });
    expect(screen.getAllByText(/Reclamos del Período/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/N.º\s*201/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Ruido en cabina').length).toBeGreaterThanOrEqual(1);
  });

  it('estado general actual', () => {
    renderPdf({ report: makeReport({ general_status: 'operativo' }) });
    expect(screen.getAllByText('Operativo').length).toBeGreaterThanOrEqual(1);
  });

  it('observación general actual', () => {
    renderPdf({ report: makeReport({ general_notes: 'Sin novedades este período' }) });
    expect(screen.getAllByText('Sin novedades este período').length).toBeGreaterThanOrEqual(1);
  });
});

describe('MonthlyReportPDF — Documento preliminar', () => {
  it('documento preliminar muestra PENDIENTE DE APROBACIÓN', () => {
    renderPdf({ documentStatus: 'preliminary' });
    expect(screen.getAllByText('PENDIENTE DE APROBACIÓN').length).toBeGreaterThanOrEqual(1);
  });

  it('preliminar no muestra Aprobado por', () => {
    renderPdf({ documentStatus: 'preliminary' });
    expect(screen.queryByText(/Administrador/)).not.toBeInTheDocument();
  });
});

describe('MonthlyReportPDF — Documento aprobado', () => {
  it('aprobado muestra APROBADO', () => {
    renderPdf({ documentStatus: 'approved', signerName: 'Juan Pérez' });
    expect(screen.getAllByText('Administrador').length).toBeGreaterThanOrEqual(1);
  });

  it('aprobado muestra fecha argentina', () => {
    renderPdf({ documentStatus: 'approved', approvedAt: '4/8/2026' });
    expect(screen.getAllByText('4/8/2026').length).toBeGreaterThanOrEqual(1);
  });

  it('aprobado muestra nombre real del aprobador', () => {
    renderPdf({ documentStatus: 'approved', signerName: 'Juan Pérez' });
    expect(screen.getAllByText('Juan Pérez').length).toBeGreaterThanOrEqual(1);
  });

  it('aprobado muestra firma', () => {
    renderPdf({ documentStatus: 'approved', signatureUrl: 'https://sig.test/sig.png' });
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(1);
  });
});

describe('MonthlyReportPDF — Versión y prueba', () => {
  it('versión correcta', () => {
    renderPdf({ report: makeReport({ pdf_version: 5 }) });
    expect(screen.getAllByText(/v5/).length).toBeGreaterThanOrEqual(1);
  });

  it('documento de prueba conserva banner', () => {
    renderPdf({ isTestDocument: true });
    expect(screen.getAllByText(/DOCUMENTO DE PRUEBA/).length).toBeGreaterThanOrEqual(1);
  });

  it('fechas DATE no se desplazan', () => {
    renderPdf({
      maintenances: [
        { service_type: 'preventivo', status: 'approved', service_date: '2026-07-05', technician: { full_name: 'Juan Técnico' }, description: 'Trabajo' },
      ],
    });
    expect(screen.getAllByText('5/7/2026').length).toBeGreaterThanOrEqual(1);
  });
});
