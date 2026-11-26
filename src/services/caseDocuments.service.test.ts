import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CASE_DOCUMENT_BUCKET,
  CASE_DOCUMENT_MAX_BYTES,
  getDocumentUrl,
  listCaseDocuments,
  uploadCaseDocument,
  validateCasePdf,
} from './caseDocuments.service';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), from: vi.fn(), rpc: vi.fn(), storageFrom: vi.fn(),
  upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn(),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: mocks.storageFrom },
  },
}));

const caseId = '10000000-0000-4000-8000-000000000001';
const userId = '20000000-0000-4000-8000-000000000001';
const documentId = '30000000-0000-4000-8000-000000000001';
const storagePath = `${caseId}/${userId}/${documentId}.pdf`;
const attachmentRow = {
  id: documentId,
  service_case_id: caseId,
  title: 'Informe 2023',
  file_name: 'Informe 2023.pdf',
  storage_path: storagePath,
  file_size: 120,
  document_date: '2023-04-15',
  uploaded_at: '2026-11-26T20:00:00Z',
  uploaded_by: userId,
  uploaded_user: { full_name: 'Administración' },
};
const pdf = () => new File(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'], 'Informe 2023.pdf', { type: 'application/pdf' });

function queryResult(result: unknown) {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue(result), maybeSingle: vi.fn().mockResolvedValue(result) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(documentId);
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mocks.storageFrom.mockReturnValue({ upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.createSignedUrl });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: attachmentRow, error: null });
  mocks.from.mockReturnValue(queryResult({ data: null, error: null }));
});

describe('validateCasePdf', () => {
  it('accepts a PDF with an uppercase extension and missing browser MIME', async () => {
    await expect(validateCasePdf(new File(['%PDF-1.7\n%%EOF'], 'informe.PDF'))).resolves.toBeUndefined();
  });

  it.each([
    ['file with another extension', () => new File(['%PDF-1.4'], 'informe.txt', { type: 'text/plain' }), /Seleccioná un archivo PDF/],
    ['renamed text file', () => new File(['No soy un PDF'], 'informe.pdf', { type: 'application/pdf' }), /no contiene un PDF válido/],
    ['empty PDF', () => new File([], 'informe.pdf', { type: 'application/pdf' }), /está vacío/],
    ['unsafe name', () => new File(['%PDF-1.4'], '../informe.pdf', { type: 'application/pdf' }), /Renombrá el archivo/],
  ])('rejects %s before any upload', async (_, makeFile, message) => {
    await expect(uploadCaseDocument({ serviceCaseId: caseId, file: makeFile() })).rejects.toThrow(message);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects PDFs larger than 20 MB', async () => {
    const file = pdf();
    Object.defineProperty(file, 'size', { value: CASE_DOCUMENT_MAX_BYTES + 1 });
    await expect(validateCasePdf(file)).rejects.toThrow('supera el máximo de 20 MB');
  });
});

describe('uploadCaseDocument', () => {
  it('uploads a private PDF without overwriting and registers original date independently', async () => {
    const file = pdf();
    const result = await uploadCaseDocument({ serviceCaseId: caseId, file, title: ' Informe 2023 ', documentDate: '2023-04-15' });
    expect(mocks.storageFrom).toHaveBeenCalledWith(CASE_DOCUMENT_BUCKET);
    expect(mocks.upload).toHaveBeenCalledWith(storagePath, file, { contentType: 'application/pdf', upsert: false });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('register_service_case_document', {
      p_document_id: documentId, p_case_id: caseId, p_file_name: 'Informe 2023.pdf', p_title: 'Informe 2023', p_document_date: '2023-04-15',
    });
    expect(result).toMatchObject({ documentType: 'attachment', documentDate: '2023-04-15', storageBucket: CASE_DOCUMENT_BUCKET, generatedAt: '2026-11-26T20:00:00Z' });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('uses the filename as a default title and permits an unknown original date', async () => {
    await uploadCaseDocument({ serviceCaseId: caseId, file: pdf() });
    expect(mocks.rpc).toHaveBeenCalledWith('register_service_case_document', expect.objectContaining({ p_title: 'Informe 2023', p_document_date: null }));
  });

  it('requires a signed-in account', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(uploadCaseDocument({ serviceCaseId: caseId, file: pdf() })).rejects.toThrow('Iniciá sesión');
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rejects impossible original dates before uploading', async () => {
    await expect(uploadCaseDocument({ serviceCaseId: caseId, file: pdf(), documentDate: '2023-02-31' })).rejects.toThrow('fecha del documento');
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('does not register a document when Storage rejects the upload', async () => {
    mocks.upload.mockResolvedValue({ error: { message: 'No permitido' } });
    await expect(uploadCaseDocument({ serviceCaseId: caseId, file: pdf() })).rejects.toThrow('No se pudo subir el PDF: No permitido');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('removes an unregistered upload if registration fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Sin permisos' } });
    await expect(uploadCaseDocument({ serviceCaseId: caseId, file: pdf() })).rejects.toThrow('Sin permisos');
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([storagePath]);
  });

  it('recovers a committed registration after a lost response without deleting the PDF', async () => {
    mocks.rpc.mockRejectedValue(new Error('Network response lost'));
    mocks.from.mockReturnValue(queryResult({ data: attachmentRow, error: null }));
    const result = await uploadCaseDocument({ serviceCaseId: caseId, file: pdf() });
    expect(result.id).toBe(documentId);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('explains an unresolved cleanup failure so the user can refresh before retrying', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Registro fallido' } });
    mocks.remove.mockResolvedValue({ error: { message: 'Sin conexión' } });
    await expect(uploadCaseDocument({ serviceCaseId: caseId, file: pdf() })).rejects.toThrow('No se pudo confirmar la limpieza');
  });
});

describe('document listing and private download', () => {
  it('combines generated versions and attachments within the requested case', async () => {
    const orders = queryResult({ data: [{ id: 'order-pdf', version: 2, generated_at: '2026-10-01T12:00:00Z', generated_by: userId, storage_path: 'orders/file.pdf', is_current: true, order: { subject: 'Revisión', status: 'approved' }, generated_user: { full_name: 'Supervisión' } }], error: null });
    const attachments = queryResult({ data: [attachmentRow], error: null });
    mocks.from.mockImplementation((table: string) => table === 'service_order_pdf_versions' ? orders : attachments);
    const result = await listCaseDocuments(caseId);
    expect(orders.eq).toHaveBeenCalledWith('service_case_id', caseId);
    expect(attachments.eq).toHaveBeenCalledWith('service_case_id', caseId);
    expect(result.map(document => document.documentType)).toEqual(['attachment', 'order_pdf']);
    expect(result[1]).toMatchObject({ storageBucket: 'service-order-reports', generatedByName: 'Supervisión', version: 2 });
  });

  it('surfaces a listing error rather than presenting an empty history', async () => {
    mocks.from.mockReturnValue(queryResult({ data: null, error: { message: 'Error de lectura' } }));
    await expect(listCaseDocuments(caseId)).rejects.toMatchObject({ message: 'Error de lectura' });
  });

  it('uses the correct private bucket and a short-lived signed URL', async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.com/private.pdf' }, error: null });
    expect(await getDocumentUrl({ storagePath, storageBucket: CASE_DOCUMENT_BUCKET })).toBe('https://example.com/private.pdf');
    expect(mocks.storageFrom).toHaveBeenCalledWith(CASE_DOCUMENT_BUCKET);
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(storagePath, 300);
  });

  it('reports an unauthorized download instead of silently doing nothing', async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'Acceso denegado' } });
    await expect(getDocumentUrl({ storagePath, storageBucket: CASE_DOCUMENT_BUCKET })).rejects.toMatchObject({ message: 'Acceso denegado' });
  });
});
