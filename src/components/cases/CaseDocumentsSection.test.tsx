import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CaseDocumentsSection from './CaseDocumentsSection';
import { getDocumentUrl, listCaseDocuments, uploadCaseDocument } from '@/services/caseDocuments.service';
import type { CaseDocument } from '@/services/caseDocuments.service';

vi.mock('@/services/caseDocuments.service', () => ({
  listCaseDocuments: vi.fn(), getDocumentUrl: vi.fn(), uploadCaseDocument: vi.fn(),
}));

const attachment: CaseDocument = {
  id: 'attachment-id', documentType: 'attachment', title: 'Informe histórico', fileName: 'informe-2023.pdf',
  version: 1, status: 'attached', generatedAt: '2026-11-26T20:00:00Z', documentDate: '2023-04-15',
  storagePath: 'case/user/attachment.pdf', storageBucket: 'service-case-documents', isCurrent: false,
  generatedByName: 'Administración', fileSize: 1024,
};
const generated: CaseDocument = {
  id: 'generated-id', documentType: 'order_pdf', title: 'Orden de Servicio — Revisión', fileName: 'orden.pdf',
  version: 2, status: 'approved', generatedAt: '2026-10-01T20:00:00Z',
  storagePath: 'order/generated.pdf', storageBucket: 'service-order-reports', isCurrent: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listCaseDocuments).mockResolvedValue([]);
  vi.mocked(uploadCaseDocument).mockResolvedValue(attachment);
});

describe('CaseDocumentsSection', () => {
  it('keeps generated PDFs and historical attachments distinguishable, with the original date', async () => {
    vi.mocked(listCaseDocuments).mockResolvedValue([attachment, generated]);
    render(<CaseDocumentsSection serviceCaseId="case-id" canUpload />);
    expect(await screen.findByText('Informe histórico')).toBeInTheDocument();
    expect(screen.getByText('PDF adjunto')).toBeInTheDocument();
    expect(screen.getByText('Vigente')).toBeInTheDocument();
    expect(screen.getByText('Fecha del documento: 15/4/2023')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver informe-2023.pdf' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Descargar orden.pdf' })).toBeEnabled();
  });

  it('uploads a selected PDF with its date, refreshes the list and clears the form', async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    vi.mocked(listCaseDocuments).mockResolvedValueOnce([]).mockResolvedValue([attachment]);
    render(<CaseDocumentsSection serviceCaseId="case-id" canUpload onDocumentUploaded={onUploaded} />);
    await screen.findByText('No hay documentos en este expediente.');
    const file = new File(['%PDF-1.4\n%%EOF'], 'informe-2023.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Archivo PDF'), file);
    const title = screen.getByLabelText('Título del documento');
    expect(title).toHaveValue('informe-2023');
    await user.clear(title);
    await user.type(title, 'Informe histórico');
    fireEvent.change(screen.getByLabelText('Fecha del documento (opcional)'), { target: { value: '2023-04-15' } });
    await user.click(screen.getByRole('button', { name: 'Adjuntar PDF' }));
    expect(await screen.findByText('PDF adjuntado al expediente.')).toBeInTheDocument();
    expect(uploadCaseDocument).toHaveBeenCalledExactlyOnceWith({ serviceCaseId: 'case-id', file, title: 'Informe histórico', documentDate: '2023-04-15' });
    await waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
    expect(screen.getByText('Informe histórico')).toBeInTheDocument();
    expect(screen.getByLabelText('Título del documento')).toHaveValue('');
    expect(screen.getByLabelText('Fecha del documento (opcional)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Adjuntar PDF' })).toBeDisabled();
  });

  it('prevents duplicate submissions while a PDF is being uploaded', async () => {
    const user = userEvent.setup();
    let finishUpload!: (document: CaseDocument) => void;
    vi.mocked(uploadCaseDocument).mockReturnValue(new Promise(resolve => { finishUpload = resolve; }));
    render(<CaseDocumentsSection serviceCaseId="case-id" canUpload />);
    await user.upload(screen.getByLabelText('Archivo PDF'), new File(['%PDF-1.4'], 'informe.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Adjuntar PDF' }));
    expect(screen.getByRole('button', { name: 'Adjuntando PDF...' })).toBeDisabled();
    expect(screen.getByLabelText('Archivo PDF')).toBeDisabled();
    expect(uploadCaseDocument).toHaveBeenCalledOnce();
    finishUpload(attachment);
    await screen.findByText('PDF adjuntado al expediente.');
  });

  it('shows validation or permission errors and preserves the selection for correction', async () => {
    vi.mocked(uploadCaseDocument).mockRejectedValue(new Error('El PDF supera el máximo de 20 MB.'));
    const user = userEvent.setup();
    render(<CaseDocumentsSection serviceCaseId="case-id" canUpload />);
    await user.upload(screen.getByLabelText('Archivo PDF'), new File(['%PDF-1.4'], 'informe.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Adjuntar PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El PDF supera el máximo de 20 MB.');
    expect(screen.getByLabelText('Título del documento')).toHaveValue('informe');
    expect(screen.getByRole('button', { name: 'Adjuntar PDF' })).toBeEnabled();
    expect(screen.queryByText('PDF adjuntado al expediente.')).not.toBeInTheDocument();
  });

  it('offers a retry when documents could not be read, without reporting an empty case', async () => {
    vi.mocked(listCaseDocuments).mockRejectedValueOnce(new Error('No se pudieron cargar los documentos.')).mockResolvedValue([attachment]);
    const user = userEvent.setup();
    render(<CaseDocumentsSection serviceCaseId="case-id" canUpload />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los documentos.');
    expect(screen.queryByText('No hay documentos en este expediente.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actualizar documentos' }));
    expect(await screen.findByText('Informe histórico')).toBeInTheDocument();
  });

  it('does not expose the upload form to a read-only caller', async () => {
    render(<CaseDocumentsSection serviceCaseId="case-id" />);
    await screen.findByText('No hay documentos en este expediente.');
    expect(screen.queryByRole('button', { name: 'Adjuntar PDF' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Archivo PDF')).not.toBeInTheDocument();
  });

  it('opens the correct private attachment and closes the blank tab on access failure', async () => {
    vi.mocked(listCaseDocuments).mockResolvedValue([attachment]);
    vi.mocked(getDocumentUrl).mockRejectedValue(new Error('Acceso denegado'));
    const close = vi.fn();
    const tab = { opener: {}, location: { replace: vi.fn() }, close };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const user = userEvent.setup();
    render(<CaseDocumentsSection serviceCaseId="case-id" />);
    await user.click(await screen.findByRole('button', { name: 'Ver informe-2023.pdf' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso denegado');
    expect(getDocumentUrl).toHaveBeenCalledWith(attachment);
    expect(close).toHaveBeenCalledOnce();
    expect(tab.opener).toBeNull();
  });
});
