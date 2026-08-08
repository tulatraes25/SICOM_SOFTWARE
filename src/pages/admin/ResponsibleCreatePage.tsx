import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { createResponsible, getAdminUsersErrorMessage } from '@/services/adminUsers.service';
import { listClients } from '@/services/clients.service';
import { getBuildingsByClient } from '@/services/buildings.service';
import { filterElevators } from '@/services/elevators.service';
import type { Client } from '@/types/database';
import type { Building } from '@/types/database';
import type { Elevator } from '@/types/database';
import { ArrowLeft, AlertCircle, Check } from 'lucide-react';

function isValidEmail(v: string): boolean {
  const t = v.trim();
  if (!t || t.includes(' ')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

const naturalSort = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

export default function ResponsibleCreatePage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState('');
  const [clientId, setClientId] = useState('');

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState('');

  const [selectedBuildingIds, setSelectedBuildingIds] = useState<Set<string>>(new Set());
  const [selectedElevatorIds, setSelectedElevatorIds] = useState<Set<string>>(new Set());

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [operation, setOperation] = useState<'loading' | 'saving' | null>(null);
  const submitRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    return () => {
      requestRef.current++;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    setClientsError('');
    try {
      const data = await listClients();
      setClients(data.filter((c) => c.active));
    } catch (err: unknown) {
      setClientsError(getAdminUsersErrorMessage(err));
    } finally {
      setClientsLoading(false);
    }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const loadAssignments = useCallback(async (cid: string) => {
    const reqId = ++requestRef.current;
    setLoadingAssignments(true);
    setAssignmentsError('');
    setBuildings([]);
    setElevators([]);
    setSelectedBuildingIds(new Set());
    setSelectedElevatorIds(new Set());
    try {
      const [blds, elvs] = await Promise.all([
        getBuildingsByClient(cid),
        filterElevators({ client_id: cid }),
      ]);
      if (reqId !== requestRef.current) return;
      const activeBuildingIds = new Set(blds.map((b) => b.id));
      const eligible = elvs.filter(
        (e) => e.active && !e.responsible_user_id && activeBuildingIds.has(e.building_id),
      );
      setBuildings(blds);
      setElevators(eligible);
    } catch (err: unknown) {
      if (reqId !== requestRef.current) return;
      setAssignmentsError(getAdminUsersErrorMessage(err));
    } finally {
      if (reqId === requestRef.current) setLoadingAssignments(false);
    }
  }, []);

  useEffect(() => {
    if (clientId) {
      loadAssignments(clientId);
    } else {
      requestRef.current++;
      setLoadingAssignments(false);
      setAssignmentsError('');
      setBuildings([]);
      setElevators([]);
      setSelectedBuildingIds(new Set());
      setSelectedElevatorIds(new Set());
    }
  }, [clientId, loadAssignments]);

  const elevatorsByBuilding = useCallback((buildingId: string) => {
    return elevators.filter((e) => e.building_id === buildingId).sort((a, b) => naturalSort.compare(a.code, b.code));
  }, [elevators]);

  const handleClientChange = (value: string) => {
    setClientId(value);
  };

  const handleBuildingToggle = (buildingId: string) => {
    setSelectedBuildingIds((prev) => {
      const next = new Set(prev);
      if (next.has(buildingId)) {
        next.delete(buildingId);
        setSelectedElevatorIds((prevEl) => {
          const nextEl = new Set(prevEl);
          for (const e of elevatorsByBuilding(buildingId)) {
            nextEl.delete(e.id);
          }
          return nextEl;
        });
      } else {
        next.add(buildingId);
        setSelectedElevatorIds((prevEl) => {
          const nextEl = new Set(prevEl);
          for (const e of elevatorsByBuilding(buildingId)) {
            nextEl.add(e.id);
          }
          return nextEl;
        });
      }
      return next;
    });
  };

  const handleElevatorToggle = (elevatorId: string) => {
    setSelectedElevatorIds((prev) => {
      const next = new Set(prev);
      if (next.has(elevatorId)) {
        next.delete(elevatorId);
      } else {
        next.add(elevatorId);
      }
      return next;
    });
  };

  const selectedClientName = clients.find((c) => c.id === clientId)?.name || '';

  const summaryBuildings = buildings.filter((b) => selectedBuildingIds.has(b.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitRef.current) return;
    setError('');
    setSuccess('');

    const normalizedName = fullName.trim();
    if (!normalizedName) { setError('El nombre es obligatorio'); return; }
    if (!isValidEmail(email)) { setError('Ingresá un email válido'); return; }
    if (password.trim().length === 0 || password.length < 8 || password.length > 128) {
      setError('La contraseña debe tener entre 8 y 128 caracteres'); return;
    }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }
    if (!clientId) { setError('Seleccioná un cliente'); return; }
    if (selectedBuildingIds.size === 0) { setError('Seleccioná al menos un edificio'); return; }
    if (selectedElevatorIds.size === 0) { setError('Seleccioná al menos un ascensor'); return; }
    if (selectedElevatorIds.size > 100) { setError('No se pueden asignar más de 100 ascensores'); return; }

    submitRef.current = true;
    setOperation('saving');
    try {
      const elevatorIds = [...buildings]
        .sort((a, b) => naturalSort.compare(a.name, b.name))
        .flatMap((building) =>
          elevatorsByBuilding(building.id)
            .filter((elevator) => selectedElevatorIds.has(elevator.id))
            .map((elevator) => elevator.id),
        );
      if (elevatorIds.length !== selectedElevatorIds.size) {
        throw new Error('Inconsistencia en la selección de ascensores');
      }
      const result = await createResponsible({
        email: email.trim().toLowerCase(),
        password,
        full_name: normalizedName,
        elevator_ids: elevatorIds,
      });
      setSuccess(`Responsable creado correctamente. Se asignaron ${result.assigned_elevator_ids.length} ascensores. Deberá cambiar la contraseña temporal al iniciar sesión.`);
      setPassword('');
      setConfirmPassword('');
      timerRef.current = setTimeout(() => navigate(`/admin/usuarios/${result.user.id}`), 800);
    } catch (err: unknown) {
      submitRef.current = false;
      setError(getAdminUsersErrorMessage(err));
    } finally {
      setOperation(null);
    }
  };

  const isBusy = operation !== null || success !== '';
  const isFormBusy = clientsLoading || loadingAssignments || isBusy;

  return (
    <DashboardLayout role="admin" title="Nuevo responsable">
      <div className="max-w-2xl mx-auto space-y-4 2xl:space-y-6">
        <button
          type="button"
          onClick={() => { if (!isBusy) navigate('/admin/usuarios?tab=responsables'); }}
          disabled={isBusy}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
          aria-label="Volver"
        >
          <ArrowLeft size={18} /> Volver
        </button>

        <div>
          <h2 className="text-lg font-semibold">Nuevo responsable</h2>
          <p className="text-gray-500 text-sm">Creá el acceso y asigná los ascensores que podrá consultar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 2xl:space-y-6" aria-busy={isFormBusy}>
          {error && <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
          {success && <div role="status" className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2"><Check size={16} /> {success}</div>}

          <Card>
            <CardHeader><h3 className="font-semibold">Datos del responsable</h3></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Nombre completo *" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" disabled={isBusy} />
              <Input label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={isBusy} />
              <Input label="Contraseña temporal *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" disabled={isBusy} />
              <Input label="Confirmar contraseña *" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" disabled={isBusy} />
              <div role="note" className="p-3 bg-warning/10 border border-warning/30 rounded text-warning text-sm">
                Esta contraseña es temporal. El responsable deberá cambiarla al iniciar sesión por primera vez.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="font-semibold">Asignación de edificios y ascensores</h3></CardHeader>
            <CardContent className="space-y-4">
              {clientsLoading ? (
                <p className="text-sm text-gray-500">Cargando clientes...</p>
              ) : clientsError ? (
                <div className="space-y-2">
                  <p className="text-sm text-danger" role="alert">{clientsError}</p>
                  <Button type="button" variant="outline" size="sm" onClick={loadClients} disabled={isBusy}>Reintentar carga de clientes</Button>
                </div>
              ) : clients.length === 0 ? (
                <p className="text-sm text-gray-500">No hay clientes activos disponibles.</p>
              ) : (
                <Select
                  label="Cliente *"
                  options={[{ value: '', label: 'Seleccionar cliente' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
                  value={clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  disabled={isBusy}
                />
              )}

              {clientId && !clientsLoading && !clientsError && (
                <>
                  {loadingAssignments ? (
                    <p className="text-sm text-gray-500">Cargando edificios y ascensores...</p>
                  ) : assignmentsError ? (
                    <div className="space-y-2">
                      <p className="text-sm text-danger" role="alert">{assignmentsError}</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => loadAssignments(clientId)} disabled={isBusy}>Reintentar edificios y ascensores</Button>
                    </div>
                  ) : buildings.length === 0 ? (
                    <p className="text-sm text-gray-500">El cliente no tiene edificios activos.</p>
                  ) : elevators.length === 0 ? (
                    <>
                      <p className="text-sm text-gray-500">No hay ascensores disponibles para asignar en este cliente.</p>
                      {buildings.map((b) => (
                        <fieldset key={b.id} className="border border-gray-200 rounded-lg p-4">
                          <legend className="sr-only">{b.name}</legend>
                          <div className="flex items-center gap-3">
                            <input type="checkbox" id={`building-${b.id}`} checked={false} disabled className="w-4 h-4 rounded border-gray-300" />
                            <label htmlFor={`building-${b.id}`} className="text-sm font-medium text-gray-500">{b.name} — {b.address}</label>
                            <span className="text-xs text-gray-400 ml-2">(Sin ascensores disponibles)</span>
                          </div>
                        </fieldset>
                      ))}
                    </>
                  ) : (
                    <div className="space-y-4">
                      {buildings.map((b) => {
                        const bElevators = elevatorsByBuilding(b.id);
                        const available = bElevators.length > 0;
                        const buildingSelected = selectedBuildingIds.has(b.id);
                        return (
                          <fieldset key={b.id} className="border border-gray-200 rounded-lg p-4">
                            <legend className="sr-only">{b.name}</legend>
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id={`building-${b.id}`}
                                checked={buildingSelected}
                                onChange={() => handleBuildingToggle(b.id)}
                                disabled={!available || isBusy}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                              <label htmlFor={`building-${b.id}`} className="text-sm font-medium text-gray-900 cursor-pointer">
                                {b.name} — {b.address}
                              </label>
                              {!available && <span className="text-xs text-gray-400 ml-2">(Sin ascensores disponibles)</span>}
                            </div>
                            {buildingSelected && bElevators.length > 0 && (
                              <div className="mt-3 ml-7 space-y-2">
                                {bElevators.map((el) => (
                                  <div key={el.id} className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      id={`elevator-${el.id}`}
                                      checked={selectedElevatorIds.has(el.id)}
                                      onChange={() => handleElevatorToggle(el.id)}
                                      disabled={isBusy}
                                      className="w-4 h-4 rounded border-gray-300"
                                    />
                                    <label htmlFor={`elevator-${el.id}`} className="text-sm text-gray-700 cursor-pointer">
                                      Ascensor {el.code}{el.manufacturer ? ` — ${el.manufacturer}` : ''}{el.model ? ` ${el.model}` : ''}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </fieldset>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {!clientId && !clientsLoading && (
                <p className="text-sm text-gray-500">Seleccioná un cliente para ver sus edificios.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="font-semibold">Resumen antes de crear</h3></CardHeader>
            <CardContent>
              {selectedElevatorIds.size === 0 ? (
                <p className="text-sm text-gray-500">Ningún ascensor seleccionado.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-500">Nombre: </span><span className="font-medium">{fullName || '-'}</span></div>
                  <div><span className="text-gray-500">Email: </span><span className="font-medium">{email || '-'}</span></div>
                  <div><span className="text-gray-500">Cliente: </span><span className="font-medium">{selectedClientName || '-'}</span></div>
                  <div><span className="text-gray-500">Edificios: </span><span className="font-medium">{selectedBuildingIds.size} {selectedBuildingIds.size === 1 ? 'seleccionado' : 'seleccionados'}</span></div>
                  <div><span className="text-gray-500">Ascensores: </span><span className="font-medium">{selectedElevatorIds.size} {selectedElevatorIds.size === 1 ? 'seleccionado' : 'seleccionados'}</span></div>
                  {summaryBuildings.map((b) => {
                    const count = elevatorsByBuilding(b.id).filter((e) => selectedElevatorIds.has(e.id)).length;
                    return (
                      <div key={b.id} className="ml-4 text-gray-600">
                        {b.name} — {count} {count === 1 ? 'ascensor' : 'ascensores'}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { if (!isBusy) navigate('/admin/usuarios?tab=responsables'); }} disabled={isBusy}>Cancelar</Button>
            <Button type="submit" disabled={isBusy}>{operation === 'saving' ? 'Creando responsable...' : 'Crear responsable'}</Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
