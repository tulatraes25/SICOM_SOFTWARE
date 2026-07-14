import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getBudget, markBudgetReady, markBudgetSent, acceptBudget, rejectBudget, cancelBudget, recalculateBudget, addBudgetItem, updateBudgetItem, deleteBudgetItem } from '@/services/budgets.service';
import { BUDGET_STATUS_LABELS } from '@/types/database';
import type { Budget } from '@/types/database';
import { ArrowLeft, X, Check, Send, AlertCircle, Plus, Trash2 } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', ready: 'info', sent: 'info', accepted: 'success',
  rejected: 'danger', expired: 'warning', cancelled: 'danger',
};
const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

export default function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Item editing state
  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unit: '', unit_price: 0, notes: '' });
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemData, setEditItemData] = useState({ description: '', quantity: 1, unit: '', unit_price: 0, notes: '' });

  useEffect(() => { if (id) loadBudget(); }, [id]);

  const loadBudget = async () => {
    if (!id) return;
    try {
      const data = await getBudget(id);
      setBudget(data);
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
  const handleSent = () => { if (!confirm('¿Marcar como enviado?')) return; handleAction(() => markBudgetSent(id!)); };
  const handleAccept = () => { if (!confirm('¿Aceptar este presupuesto?')) return; handleAction(() => acceptBudget(id!)); };
  const handleReject = () => handleAction(() => rejectBudget(id!, rejectReason)).then(() => { setShowRejectModal(false); setRejectReason(''); });
  const handleCancel = () => handleAction(() => cancelBudget(id!, cancelReason)).then(() => { setShowCancelModal(false); setCancelReason(''); });

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

  if (loading) return <DashboardLayout role="admin" title="Presupuesto"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (error && !budget) return <DashboardLayout role="admin" title="Presupuesto"><div className="max-w-2xl mx-auto"><button onClick={() => navigate('/admin/presupuestos')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft size={18} /> Volver</button><Card><CardContent><div className="text-center py-8"><AlertCircle size={48} className="mx-auto text-danger mb-4" /><p className="text-gray-600">{error}</p></div></CardContent></Card></div></DashboardLayout>;
  if (!budget) return null;

  const isDraft = budget.status === 'draft';
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
            {budget.status === 'ready' && <Button onClick={handleSent} disabled={actionLoading}><Send size={16} className="mr-2" /> Marcar Enviado</Button>}
            {budget.status === 'sent' && <Button onClick={handleAccept} disabled={actionLoading}><Check size={16} className="mr-2" /> Aceptar</Button>}
            {budget.status === 'sent' && <Button variant="outline" onClick={() => setShowRejectModal(true)} disabled={actionLoading}>Rechazar</Button>}
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
                ) : (
                  <p className="text-gray-500 text-sm">Sin ítems</p>
                )}

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
                <div><span className="text-gray-500">Fecha: </span>{new Date(budget.budget_date).toLocaleDateString('es-AR')}</div>
                {budget.valid_until && <div><span className="text-gray-500">Válido hasta: </span>{new Date(budget.valid_until).toLocaleDateString('es-AR')}</div>}
                <div><span className="text-gray-500">Creado por: </span>{(budget.created_user as any)?.full_name || '-'}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Anular Presupuesto</h3>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full border rounded-lg p-3 text-sm resize-none" rows={3} placeholder="Motivo..." />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowCancelModal(false); setCancelReason(''); }}>Cancelar</Button>
              <Button variant="danger" onClick={handleCancel} disabled={!cancelReason.trim() || actionLoading}>Anular</Button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Rechazar Presupuesto</h3>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-full border rounded-lg p-3 text-sm resize-none" rows={3} placeholder="Motivo (opcional)..." />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>Cancelar</Button>
              <Button variant="danger" onClick={handleReject} disabled={actionLoading}>Rechazar</Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
