import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { X } from 'lucide-react';
import { listByBuilding } from '@/services/buildingReportRecipients.service';
import { sendBudgetEmails } from '@/services/budgetEmail.service';
import { supabase } from '@/config/supabase';

interface SendOrderEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  caseNumber: number | string;
  numberingMode: string;
  elevatorCode: string;
  buildingName: string;
  buildingId?: string;
  onSent: () => void;
}

export default function SendOrderEmailModal({
  isOpen, onClose, orderId, caseNumber, numberingMode, elevatorCode, buildingName, buildingId, onSent
}: SendOrderEmailModalProps) {
  const [recipients, setRecipients] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [extraRecipients, setExtraRecipients] = useState<Array<{ name: string; email: string }>>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  const numberLabel = numberingMode === 'test' ? `PRUEBA N.º ${caseNumber}` : `N.º ${caseNumber}`;

  useEffect(() => {
    if (isOpen && buildingId) loadRecipients();
  }, [isOpen, buildingId]);

  useEffect(() => {
    if (isOpen) {
      setSubject(`SICOM Patagonia — Orden de Servicio ${numberLabel}`);
      setBody(`Estimado/a:\n\nAdjuntamos la Orden de Servicio ${numberLabel} correspondiente al ascensor ${elevatorCode} del edificio ${buildingName}.\n\nEl documento se encuentra adjunto en formato PDF.\n\nSaludos cordiales,\nSICOM Patagonia SRL\n+54 297 421-4430\nsicompatagonia.com`);
      setExtraRecipients([]);
      setResult('');
    }
  }, [isOpen, numberLabel, elevatorCode, buildingName]);

  const loadRecipients = async () => {
    setLoading(true);
    try {
      const contacts = await listByBuilding(buildingId!);
      setRecipients(contacts.map((c: { id: string; name: string; email: string }) => ({ id: c.id, name: c.name, email: c.email })));
      setSelectedEmails(contacts.map((c: { id: string; name: string; email: string }) => c.email));
    } catch { setRecipients([]); } finally { setLoading(false); }
  };

  const handleSend = async () => {
    const allEmails = [...selectedEmails, ...extraRecipients.map(r => r.email)];
    if (allEmails.length === 0) return;
    setSending(true); setResult('');
    try {
      const recipientsList = [
        ...recipients.filter(r => selectedEmails.includes(r.email)).map(r => ({ email: r.email, name: r.name })),
        ...extraRecipients.map(r => ({ email: r.email, name: r.name || undefined })),
      ];

      let sent = 0, failed = 0;
      for (const r of recipientsList) {
        try {
          await sendBudgetEmails({ budgetId: orderId, recipients: [r], subject, body: body.replace(/\n/g, '<br>'), pdfBase64: undefined, pdfFilename: `orden-${caseNumber}.pdf` });
          sent++;
        } catch { failed++; }
      }

      if (sent > 0) {
        try { await supabase.rpc('mark_budget_sent', { p_order_id: orderId }); } catch {}
        setResult(`Orden enviada correctamente a ${sent} destinatario(s)${failed > 0 ? `. Falló ${failed}` : ''}`);
        onSent();
      } else {
        setResult('No se pudo enviar la orden');
      }
    } catch (err: any) { setResult('Error: ' + (err?.message || '')); }
    finally { setSending(false); }
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
              <p><strong>Archivo:</strong> orden-{caseNumber}-v{1}.pdf</p>
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
                  <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Nombre (opcional)" id="extra-name" />
                  <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Correo" id="extra-email" type="email" />
                  <Button size="sm" variant="outline" onClick={() => {
                    const n = (document.getElementById('extra-name') as HTMLInputElement)?.value?.trim() || '';
                    const e = (document.getElementById('extra-email') as HTMLInputElement)?.value?.trim().toLowerCase();
                    if (!e || !e.includes('@')) return;
                    setExtraRecipients([...extraRecipients, { name: n, email: e }]);
                    (document.getElementById('extra-name') as HTMLInputElement).value = '';
                    (document.getElementById('extra-email') as HTMLInputElement).value = '';
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
