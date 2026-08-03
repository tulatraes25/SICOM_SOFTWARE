import { useState, useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import { X } from 'lucide-react';
import { listServiceOrderRecipients } from '@/services/buildingRecipients.service';
import { supabase } from '@/config/supabase';

interface EmailDeliveryResult {
  email: string;
  status: 'sent' | 'mock' | 'failed';
  error?: string;
}

interface EmailFunctionResponse {
  success: number;
  failed: number;
  results: EmailDeliveryResult[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface SendOrderEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  caseNumber: number | string;
  numberingMode: string;
  elevatorCode: string;
  buildingName: string;
  buildingId?: string;
  elevatorId?: string;
  pdfVersion?: number;
  onSent: () => void;
}

export default function SendOrderEmailModal({
  isOpen, onClose, orderId, caseNumber, numberingMode, elevatorCode, buildingName, buildingId, elevatorId, pdfVersion, onSent
}: SendOrderEmailModalProps) {
  const [recipients, setRecipients] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [extraRecipients, setExtraRecipients] = useState<Array<{ name: string; email: string }>>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [extraName, setExtraName] = useState('');
  const [extraEmail, setExtraEmail] = useState('');
  const submitRef = useRef(false);

  const numberLabel = numberingMode === 'test' ? `PRUEBA N.º ${caseNumber}` : `N.º ${caseNumber}`;

  useEffect(() => {
    if (isOpen && buildingId) loadRecipients();
  }, [isOpen, buildingId, elevatorId]);

  useEffect(() => {
    if (isOpen) {
      setSubject(`SICOM Patagonia — Orden de Servicio ${numberLabel}`);
      setBody(`Estimado/a:\n\nAdjuntamos la Orden de Servicio ${numberLabel} correspondiente al ascensor ${elevatorCode} del edificio ${buildingName}.\n\nEl documento se encuentra adjunto en formato PDF.\n\nSaludos cordiales,\nSICOM Patagonia SRL\n+54 297 421-4430\nsicompatagonia.com`);
      setExtraRecipients([]);
      setResult('');
      setExtraName('');
      setExtraEmail('');
    }
  }, [isOpen, numberLabel, elevatorCode, buildingName]);

  const loadRecipients = async () => {
    setLoading(true);
    try {
      const contacts = await listServiceOrderRecipients(buildingId!, elevatorId);
      setRecipients(contacts.map(c => ({ id: c.id, name: c.full_name, email: c.email })));
      setSelectedEmails(contacts.map(c => c.email));
    } catch { setRecipients([]); } finally { setLoading(false); }
  };

  const handleSend = async () => {
    const allEmails = [...selectedEmails, ...extraRecipients.map(r => r.email)];
    if (allEmails.length === 0) return;
    if (submitRef.current) return;
    submitRef.current = true;
    setSending(true); setResult('');
    try {
      const recipientsList = [
        ...recipients.filter(r => selectedEmails.includes(r.email)).map(r => ({ email: r.email, name: r.name })),
        ...extraRecipients.map(r => ({ email: r.email, name: r.name || undefined })),
      ];

      const { data, error } = await supabase.functions.invoke('send-service-order-email', {
        body: {
          service_order_id: orderId,
          recipients: recipientsList,
          subject,
          body: body.replace(/\n/g, '<br>'),
        },
      });

      if (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setResult(`Error al enviar: ${msg}`);
        return;
      }

      if (!isRecord(data) || typeof data.success !== 'number' || typeof data.failed !== 'number' || !Array.isArray(data.results)) {
        setResult('La respuesta del servicio de correo no es válida.');
        return;
      }

      const resp = data as unknown as EmailFunctionResponse;
      const { success, failed, results: resList } = resp;

      if (success === 0) {
        setResult(`No se pudo enviar la orden${failed > 0 ? `. ${failed} destinatario(s) fallaron` : ''}`);
        return;
      }

      const hasRealSend = resList.some((r: EmailDeliveryResult) => r.status === 'sent');

      if (failed === 0) {
        setResult(hasRealSend
          ? `Orden enviada correctamente a ${success} destinatario(s)`
          : `Envío de prueba registrado. El proveedor de correo no está configurado.`);
      } else {
        setResult(`Orden enviada a ${success} destinatario(s). Fallaron ${failed}.`);
      }

      onSent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult(`Error al enviar: ${msg}`);
    } finally {
      submitRef.current = false;
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Enviar Orden por Correo</h3>
        {result ? (
          <div className="text-center py-4">
            <p className="text-sm mb-4">{result}</p>
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded text-sm">
              <p><strong>Archivo:</strong> orden-{caseNumber}-v{pdfVersion || 1}.pdf</p>
            </div>

            {loading ? <p className="text-sm text-gray-500">Cargando destinatarios...</p> : (
              <>
                {recipients.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Destinatarios del edificio:</p>
                    {recipients.map(r => (
                      <label key={r.id} className="flex items-center gap-2 text-sm p-1">
                        <input type="checkbox" checked={selectedEmails.includes(r.email)} onChange={(e) => {
                          if (e.target.checked) setSelectedEmails([...selectedEmails, r.email]);
                          else setSelectedEmails(selectedEmails.filter(x => x !== r.email));
                        }} />
                        {r.name} ({r.email})
                      </label>
                    ))}
                  </div>
                )}

                {extraRecipients.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Adicionales:</p>
                    {extraRecipients.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{r.name ? `${r.name} (${r.email})` : r.email}</span>
                        <button onClick={() => setExtraRecipients(extraRecipients.filter((_, idx) => idx !== i))} className="text-danger"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Nombre (opcional)" value={extraName} onChange={(e) => setExtraName(e.target.value)} />
                  <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Correo" type="email" value={extraEmail} onChange={(e) => setExtraEmail(e.target.value)} />
                  <Button size="sm" variant="outline" onClick={() => {
                    const n = extraName.trim();
                    const e = extraEmail.trim().toLowerCase();
                    if (!e || !e.includes('@')) return;
                    setExtraRecipients([...extraRecipients, { name: n, email: e }]);
                    setExtraName('');
                    setExtraEmail('');
                  }}>Agregar</Button>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Asunto</label>
              <input className="w-full border rounded px-3 py-2 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cuerpo</label>
              <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">Destinatarios: {selectedEmails.length + extraRecipients.length}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSend} disabled={sending || (selectedEmails.length === 0 && extraRecipients.length === 0)}>
                  {sending ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
