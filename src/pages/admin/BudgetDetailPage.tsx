import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getBudget, markBudgetReady, markBudgetSent, acceptBudget, rejectBudget, cancelBudget, recalculateBudget, addBudgetItem, updateBudgetItem, deleteBudgetItem } from '@/services/budgets.service';
import { getBudgetRecipients, sendBudgetEmail, listBudgetEmailSends } from '@/services/budgetEmail.service';
import { getUserSignatureForPDF } from '@/services/userSignatures.service';
import BudgetPDF from '@/components/pdf/BudgetPDF';
import { BUDGET_STATUS_LABELS } from '@/types/database';
import type { Budget, BudgetEmailSend } from '@/types/database';
import { ArrowLeft, X, Check, AlertCircle, Plus, Trash2, Download, Mail } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', ready: 'info', sent: 'info', accepted: 'success',
  rejected: 'danger', expired: 'warning', cancelled: 'danger',
};
const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
const fmtDate = (d: string) => { if (!d) return '-'; const [y, m, day] = d.split('-'); return `${parseInt(day)}/${parseInt(m)}/${y}`; };

export default function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptNotes, setAcceptNotes] = useState('');
  const [acceptContact, setAcceptContact] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState('');
  const [recipients, setRecipients] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [emailSends, setEmailSends] = useState<BudgetEmailSend[]>([]);

  // Item editing
  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unit: '', unit_price: 0, notes: '' });
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemData, setEditItemData] = useState({ description: '', quantity: 1, unit: '', unit_price: 0, notes: '' });

  useEffect(() => { if (id) loadBudget(); }, [id]);

  const loadBudget = async () => {
    if (!id) return;
    try {
      const data = await getBudget(id);
      setBudget(data);
      // Load email sends
      const sends = await listBudgetEmailSends(id);
      setEmailSends(sends);
    } catch (err: any) { setError(err?.message || 'Error al cargar'); }
    finally { setLoading(false); }
  };

  const handleAction = async (action: () => Promise<void>) => {
    setActionLoading(true); setError(''); setSuccess('');
    try { await action(); await loadBudget(); }
    catch (err: any) { setError(err?.message || 'Error'); }
    finally { setActionLoading(false); }
  };

  const handleReady = () => { if (!confirm('¿Marcar como listo para enviar?')) return; handleAction(() => markBudgetReady(id!)); };
  const handleCancel = () => handleAction(() => cancelBudget(id!, cancelReason)).then(() => { setShowCancelModal(false); setCancelReason(''); });
  const handleReject = () => handleAction(() => rejectBudget(id!, rejectReason)).then(() => { setShowRejectModal(false); setRejectReason(''); });
  const handleAccept = () => handleAction(() => acceptBudget(id!, acceptNotes || undefined, acceptContact || undefined)).then(() => { setShowAcceptModal(false); setAcceptNotes(''); setAcceptContact(''); });

  const handleAddItem = async () => {
    if (!newItem.description.trim()) return;
    await addBudgetItem(id!, newItem);
    setNewItem({ description: '', quantity: 1, unit: '', unit_price: 0, notes: '' });
    await recalculateBudget(id!);
    await loadBudget();
  };
  const handleUpdateItem = async (itemId: string) => {
    await updateBudgetItem(itemId, editItemData);
    setEditingItem(null);
    await recalculateBudget(id!);
    await loadBudget();
  };
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('¿Eliminar este ítem?')) return;
    await deleteBudgetItem(itemId);
    await recalculateBudget(id!);
    await loadBudget();
  };

  const handleDownloadPDF = async () => {
    if (!budget) return;
    try {
      const sigData = await getUserSignatureForPDF(budget.created_by, 'administrator');
      const blob = await pdf(
        <BudgetPDF
          budget={budget}
          signatureUrl={sigData?.signedUrl || undefined}
          signerName={(budget.created_user as any)?.full_name}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `presupuesto-${(budget.service_case as any)?.case_number || 'borrador'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Error al generar PDF: ' + (err?.message || ''));
    }
  };

  const handleOpenEmailModal = async () => {
    if (!budget) return;
    const caseNum = (budget.service_case as any)?.case_number;
    const caseMode = (budget.service_case as any)?.numbering_mode;
    const numLabel = caseMode === 'test' ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;
    setEmailSubject(`Presupuesto SICOM Patagonia SRL ${numLabel}`);
    setEmailBody(`Estimado/a:

Adjuntamos el Presupuesto ${numLabel} correspondiente a "${budget.subject}"${(budget.elevator as any)?.code ? ` para el ascensor ${(budget.elevator as any).code}` : ''}${(budget.building as any)?.name ? `, ubicado en ${(budget.building as any).name}` : ''}.

Importe total: ${fmt(budget.total)}
${budget.valid_until ? `Validez: ${fmtDate(budget.valid_until)}` : ''}

Quedamos a disposición ante cualquier consulta.

Saludos cordiales,
SICOM Patagonia SRL`);

    // Load recipients
    if (budget.building_id) {
      try {
        const recs = await getBudgetRecipients(budget.building_id);
        setRecipients(recs);
        setEmailRecipients(recs.map(r => r.email));
      } catch { setRecipients([]); setEmailRecipients([]); }
    } else {
      setRecipients([]);
      setEmailRecipients([]);
    }
    setEmailResult('');
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!budget || emailRecipients.length === 0) return;
    setEmailSending(true); setEmailResult('');
    try {
      // Generate PDF blob
      const sigData = await getUserSignatureForPDF(budget.created_by, 'administrator');
      await pdf(
        <BudgetPDF
          budget={budget}
          signatureUrl={sigData?.signedUrl || undefined}
          signerName={(budget.created_user as any)?.full_name}
        />
      ).toBlob();

      let sent = 0, failed = 0;
      for (const email of emailRecipients) {
        try {
          await sendBudgetEmail(budget.id, email, undefined, emailSubject, emailBody);
          sent++;
        } catch { failed++; }
      }

      if (sent > 0) {
        await markBudgetSent(budget.id);
        setEmailResult(`Enviados: ${sent}${failed > 0 ? ` | Fallidos: ${failed}` : ''}`);
        await loadBudget();
      } else {
        setEmailResult('No se pudo enviar a ningún destinatario');
      }
    } catch (err: any) {
      setEmailResult('Error: ' + (err?.message || ''));
    } finally { setEmailSending(false); }
  };

  if (loading) return <DashboardLayout role="admin" title="Presupuesto"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (error && !budget) return <DashboardLayout role="admin" title="Presupuesto"><div className="max-w-2xl mx-auto"><button onClick={() => navigate('/admin/presupuestos')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft size={18} /> Volver</button><Card><CardContent><div className="text-center py-8"><AlertCircle size={48} className="mx-auto text-danger mb-4" /><p className="text-gray-600">{error}</p></div></CardContent></Card></div></DashboardLayout>;
  if (!budget) return null;

  const isDraft = budget.status === 'draft';
  const isReady = budget.status === 'ready';
  const isSent = budget.status === 'sent';
  const caseNum = (budget.service_case as any)?.case_number;
  const caseMode = (budget.service_case as any)?.numbering_mode;

  return (
    <DashboardLayout role="admin" title={`Presupuesto ${caseMode === 'test' ? 'PRUEBA ' : ''}N.º ${caseNum}`}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <button onClick={() => navigate('/admin/presupuestos')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"><ArrowLeft size={18} /> Volver</button>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{caseMode === 'test' ? 'PRUEBA ' : ''}N.º {caseNum}</h2>
              <Badge variant={STATUS_BADGE[budget.status]}>{BUDGET_STATUS_LABELS[budget.status]}</Badge>
            </div>
            <p className="text-gray-500">{budget.subject}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isDraft && <Button onClick={handleReady} disabled={actionLoading}>Marcar Listo</Button>}
            {isReady && <Button onClick={handleDownloadPDF} disabled={actionLoading}><Download size={16} className="mr-2" /> PDF</Button>}
            {isReady && <Button onClick={handleOpenEmailModal} disabled={actionLoading}><Mail size={16} className="mr-2" /> Enviar</Button>}
            {isReady && <Button variant="outline" onClick={() => handleAction(() => markBudgetReady(id!)).then(() => {})} disabled={actionLoading}>Volver a borrador</Button>}
            {isSent && <Button onClick={handleDownloadPDF}><Download size={16} className="mr-2" /> PDF</Button>}
            {isSent && <Button onClick={handleOpenEmailModal}><Mail size={16} className="mr-2" /> Reenviar</Button>}
            {isSent && <Button onClick={() => setShowAcceptModal(true)}>Registrar Aceptación</Button>}
            {isSent && <Button variant="outline" onClick={() => setShowRejectModal(true)}>Registrar Rechazo</Button>}
            {!['accepted', 'cancelled'].includes(budget.status) && <Button variant="danger" onClick={() => setShowCancelModal(true)} disabled={actionLoading}><X size={16} className="mr-2" /> Anular</Button>}
          </div>
        </div>

        {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        {success && <div className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm">{success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><h3 className="font-semibold">Ítems</h3></CardHeader>
              <CardContent>
                {budget.items && budget.items.length > 0 ? (
                  <div className="space-y-2">
                    {budget.items.sort((a, b) => a.item_order - b.item_order).map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 border rounded">
                        {editingItem === item.id ? (
                          <div className="flex-1 grid grid-cols-4 gap-2">
                            <input className="col-span-2 border rounded px-2 py-1 text-sm" value={editItemData.description} onChange={(e) => setEditItemData({ ...editItemData, description: e.target.value })} />
                            <input type="number" className="border rounded px-2 py-1 text-sm" value={editItemData.quantity} onChange={(e) => setEditItemData({ ...editItemData, quantity: +e.target.value })} />
                            <input type="number" className="border rounded px-2 py-1 text-sm" value={editItemData.unit_price} onChange={(e) => setEditItemData({ ...editItemData, unit_price: +e.target.value })} />
                            <div className="col-span-4 flex gap-2">
                              <Button size="sm" onClick={() => handleUpdateItem(item.id)}>Guardar</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 text-sm">{item.description}</span>
                            <span className="text-sm text-gray-500">x{item.quantity}</span>
                            <span className="text-sm font-medium">{fmt(item.line_subtotal)}</span>
                            {isDraft && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => { setEditingItem(item.id); setEditItemData({ description: item.description, quantity: item.quantity, unit: item.unit || '', unit_price: item.unit_price, notes: item.notes || '' }); }}>Editar</Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(item.id)}><Trash2 size={12} className="text-danger" /></Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-500 text-sm">Sin ítems</p>}

                {isDraft && (
                  <div className="mt-4 p-3 border-2 border-dashed rounded-lg space-y-2">
                    <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Descripción del ítem" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" className="border rounded px-3 py-2 text-sm" placeholder="Cantidad" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: +e.target.value })} />
                      <input className="border rounded px-3 py-2 text-sm" placeholder="Unidad" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
                      <input type="number" className="border rounded px-3 py-2 text-sm" placeholder="Precio unitario" value={newItem.unit_price || ''} onChange={(e) => setNewItem({ ...newItem, unit_price: +e.target.value })} />
                    </div>
                    <Button size="sm" onClick={handleAddItem}><Plus size={14} className="mr-1" /> Agregar Ítem</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><h3 className="font-semibold">Totales</h3></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(budget.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">IVA {budget.tax_rate}%</span><span>{fmt(budget.tax_amount)}</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>{fmt(budget.total)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><h3 className="font-semibold">Información</h3></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-gray-500">Cliente: </span>{(budget.client as any)?.name || '-'}</div>
                <div><span className="text-gray-500">Edificio: </span>{(budget.building as any)?.name || '-'}</div>
                <div><span className="text-gray-500">Ascensor: </span>{(budget.elevator as any)?.code || '-'}</div>
                <div><span className="text-gray-500">Fecha: </span>{fmtDate(budget.budget_date)}</div>
                {budget.valid_until && <div><span className="text-gray-500">Válido hasta: </span>{fmtDate(budget.valid_until)}</div>}
              </CardContent>
            </Card>
            {emailSends.length > 0 && (
              <Card>
                <CardHeader><h3 className="font-semibold">Historial de envíos</h3></CardHeader>
                <CardContent className="space-y-2">
                  {emailSends.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-sm p-2 border rounded">
                      {s.status === 'sent' ? <Check size={14} className="text-success" /> : <X size={14} className="text-danger" />}
                      <span className="flex-1">{s.recipient_email}</span>
                      <span className="text-xs text-gray-500">{new Date(s.sent_at).toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Enviar Presupuesto por Correo</h3>
            {emailResult ? (
              <div className="text-center py-4">
                <p className="text-sm mb-4">{emailResult}</p>
                <Button onClick={() => { setShowEmailModal(false); setEmailResult(''); }}>Cerrar</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recipients.length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay destinatarios configurados para este edificio.</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">Destinatarios:</p>
                    {recipients.map((r) => (
                      <label key={r.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={emailRecipients.includes(r.email)} onChange={(e) => {
                          if (e.target.checked) setEmailRecipients([...emailRecipients, r.email]);
                          else setEmailRecipients(emailRecipients.filter(x => x !== r.email));
                        }} />
                        {r.name} ({r.email})
                      </label>
                    ))}
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Asunto</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cuerpo</label>
                  <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={8} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEmailModal(false)}>Cancelar</Button>
                  <Button onClick={handleSendEmail} disabled={emailSending || emailRecipients.length === 0}>
                    {emailSending ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accept Modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Registrar Aceptación del Cliente</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Contacto</label>
                <input className="w-full border rounded px-3 py-2 text-sm" value={acceptContact} onChange={(e) => setAcceptContact(e.target.value)} placeholder="Nombre de quien confirmó" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Observaciones</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={2} value={acceptNotes} onChange={(e) => setAcceptNotes(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAcceptModal(false)}>Cancelar</Button>
                <Button onClick={handleAccept} disabled={actionLoading}>Confirmar Aceptación</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Registrar Rechazo del Cliente</h3>
            <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo del rechazo..." />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancelar</Button>
              <Button variant="danger" onClick={handleReject} disabled={!rejectReason.trim() || actionLoading}>Rechazar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Anular Presupuesto</h3>
            <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo..." />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowCancelModal(false)}>Cancelar</Button>
              <Button variant="danger" onClick={handleCancel} disabled={!cancelReason.trim() || actionLoading}>Anular</Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
