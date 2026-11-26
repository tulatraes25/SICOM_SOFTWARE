import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormEvent } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import { listCaseDocuments, getDocumentUrl, uploadCaseDocument } from '@/services/caseDocuments.service';
import type { CaseDocument } from '@/services/caseDocuments.service';
import { formatDateOnlyEsAR, formatTimestampDateEsAR } from '@/lib/dateUtils';
import { FileText, Download, Eye, Upload } from 'lucide-react';

interface CaseDocumentsSectionProps {
  serviceCaseId: string;
  canUpload?: boolean;
  onDocumentUploaded?: () => void;
}

function errorMessage(error: unknown, fallback: string): string {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : fallback;
}

function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.ceil(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
}

export default function CaseDocumentsSection({ serviceCaseId, canUpload = false, onDocumentUploaded }: CaseDocumentsSectionProps) {
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busyDocument, setBusyDocument] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const loadRequest = useRef(0);

  const loadDocuments = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoading(true);
    setLoadError('');
    try {
      const docs = await listCaseDocuments(serviceCaseId);
      if (request === loadRequest.current) setDocuments(docs);
    } catch (err) {
      if (request === loadRequest.current) setLoadError(errorMessage(err, 'No se pudieron cargar los documentos.'));
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [serviceCaseId]);

  useEffect(() => {
    void loadDocuments();
    return () => { loadRequest.current += 1; };
  }, [loadDocuments]);

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || uploading || !canUpload) return;
    setUploading(true);
    setActionError('');
    setNotice('');
    try {
      await uploadCaseDocument({ serviceCaseId, file, title, documentDate });
      setFile(null);
      setTitle('');
      setDocumentDate('');
      if (fileInput.current) fileInput.current.value = '';
      setNotice('PDF adjuntado al expediente.');
      await loadDocuments();
      onDocumentUploaded?.();
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo adjuntar el PDF.'));
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (document: CaseDocument) => {
    setActionError('');
    // Open synchronously from the click so mobile browsers do not block the tab
    // while the private, short-lived download URL is being requested.
    const newTab = window.open('', '_blank');
    if (!newTab) {
      setActionError('El navegador bloqueó la vista del PDF. Permití ventanas emergentes o usá Descargar.');
      return;
    }
    newTab.opener = null;
    setBusyDocument(document.id);
    try {
      newTab.location.replace(await getDocumentUrl(document));
    } catch (err) {
      newTab.close();
      setActionError(errorMessage(err, 'No se pudo abrir el PDF.'));
    } finally {
      setBusyDocument(null);
    }
  };

  const handleDownload = async (document: CaseDocument) => {
    setActionError('');
    setBusyDocument(document.id);
    let blobUrl: string | undefined;
    try {
      const url = await getDocumentUrl(document);
      const response = await fetch(url);
      if (!response.ok) throw new Error('No se pudo descargar el PDF. Volvé a intentar.');
      blobUrl = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = document.fileName;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudo descargar el PDF.'));
    } finally {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBusyDocument(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold flex items-center gap-2">
          <FileText size={18} />
          Documentos del Expediente
        </h3>
      </CardHeader>
      <CardContent className="space-y-4">
        {canUpload && (
          <form onSubmit={handleUpload} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Adjuntá informes anteriores u otros documentos PDF, hasta 20 MB por archivo.</p>
            <Input
              ref={fileInput}
              type="file"
              label="Archivo PDF"
              accept=".pdf,application/pdf"
              disabled={uploading}
              onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                setFile(selected);
                setTitle(selected?.name.replace(/\.pdf$/i, '').slice(0, 200) || '');
                setActionError('');
                setNotice('');
              }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Título del documento" value={title} maxLength={200} disabled={uploading}
                placeholder="Por ejemplo: Informe anual 2023" onChange={(event) => setTitle(event.target.value)} />
              <Input label="Fecha del documento (opcional)" type="date" value={documentDate} disabled={uploading}
                onChange={(event) => setDocumentDate(event.target.value)} />
            </div>
            <Button type="submit" disabled={!file || uploading} loading={uploading}>
              <Upload size={16} className="mr-2" />
              {uploading ? 'Adjuntando PDF...' : 'Adjuntar PDF'}
            </Button>
          </form>
        )}

        {notice && <p role="status" className="text-sm text-success">{notice}</p>}
        {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}
        {loadError && (
          <div role="alert" className="space-y-2 text-sm text-danger">
            <p>{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => void loadDocuments()}>Actualizar documentos</Button>
          </div>
        )}

        {loading ? (
          <div role="status" aria-label="Cargando documentos" className="flex justify-center py-6">
            <div className="w-6 h-6 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !loadError && documents.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No hay documentos en este expediente.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={`${doc.documentType}-${doc.id}`} className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                <FileText size={20} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 break-words">{doc.title}</span>
                    {doc.documentType === 'attachment' ? <Badge variant="info">PDF adjunto</Badge>
                      : doc.isCurrent ? <Badge variant="success">Vigente</Badge> : <Badge variant="default">Histórica</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 break-all">
                    {doc.documentType === 'order_pdf' && `v${doc.version} · `}{doc.fileName}
                    {doc.fileSize !== undefined && ` · ${formatFileSize(doc.fileSize)}`}
                  </p>
                  {doc.documentDate && <p className="text-xs text-gray-500">Fecha del documento: {formatDateOnlyEsAR(doc.documentDate)}</p>}
                  <p className="text-xs text-gray-500">
                    {doc.documentType === 'attachment' ? 'Adjuntado' : 'Generado'} el {formatTimestampDateEsAR(doc.generatedAt)}
                    {doc.generatedByName && ` · ${doc.generatedByName}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" aria-label={`Ver ${doc.fileName}`} title="Ver PDF"
                    disabled={busyDocument !== null} onClick={() => void handleView(doc)}>
                    <Eye size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={`Descargar ${doc.fileName}`} title="Descargar PDF"
                    disabled={busyDocument !== null} onClick={() => void handleDownload(doc)}>
                    <Download size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
