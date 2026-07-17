import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { listCaseDocuments, getDocumentUrl } from '@/services/caseDocuments.service';
import type { CaseDocument } from '@/services/caseDocuments.service';
import { FileText, Download, Eye } from 'lucide-react';

interface CaseDocumentsSectionProps {
  serviceCaseId: string;
}

export default function CaseDocumentsSection({ serviceCaseId }: CaseDocumentsSectionProps) {
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, [serviceCaseId]);

  const loadDocuments = async () => {
    try {
      const docs = await listCaseDocuments(serviceCaseId);
      setDocuments(docs);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (storagePath: string) => {
    const url = await getDocumentUrl(storagePath);
    if (url) window.open(url, '_blank');
  };

  const handleDownload = async (storagePath: string, fileName: string) => {
    const url = await getDocumentUrl(storagePath);
    if (!url) return;
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold flex items-center gap-2">
          <FileText size={18} />
          Documentos del Expediente
        </h3>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            No hay documentos generados para este expediente.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                <FileText size={20} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 truncate">{doc.title}</span>
                    {doc.isCurrent && <Badge variant="success">Vigente</Badge>}
                    {!doc.isCurrent && <Badge variant="default">Histórica</Badge>}
                  </div>
                  <p className="text-xs text-gray-500">
                    v{doc.version} · {doc.fileName} · {new Date(doc.generatedAt).toLocaleDateString('es-AR')}
                    {doc.generatedByName && ` · ${doc.generatedByName}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleView(doc.storagePath)}>
                    <Eye size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.storagePath, doc.fileName)}>
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
