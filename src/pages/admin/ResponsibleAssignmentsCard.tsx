import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getResponsibleAssignments, replaceResponsibleAssignments, getAdminUsersErrorMessage } from '@/services/adminUsers.service';
import { listClients } from '@/services/clients.service';
import { listBuildings } from '@/services/buildings.service';
import { listElevators } from '@/services/elevators.service';
import type { Client, Building, Elevator } from '@/types/database';
import { AlertCircle, Check, RefreshCw } from 'lucide-react';

interface ResponsibleAssignmentsCardProps {
  responsibleUserId: string;
  disabled?: boolean;
  onSavingChange?: (saving: boolean) => void;
}

const naturalSort = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

interface ElevatorView {
  elevator: Elevator;
  building: Building;
  client: Client;
  isCurrentlyAssigned: boolean;
  isAvailable: boolean;
  isInactive: boolean;
  isSelected: boolean;
}

interface BuildingGroup {
  building: Building;
  client: Client;
  elevators: ElevatorView[];
  allActiveSelected: boolean;
  activeCount: number;
  selectedCount: number;
}

interface ClientGroup {
  client: Client;
  buildings: BuildingGroup[];
}

export default function ResponsibleAssignmentsCard({ responsibleUserId, disabled = false, onSavingChange }: ResponsibleAssignmentsCardProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [originalAssignedIds, setOriginalAssignedIds] = useState<Set<string>>(new Set());
  const [selectedElevatorIds, setSelectedElevatorIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [staleAssignments, setStaleAssignments] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [catalogError, setCatalogError] = useState('');

  const requestRef = useRef(0);
  const saveRef = useRef(false);

  const loadData = useCallback(async () => {
    const reqId = ++requestRef.current;
    setLoading(true);
    setLoadError('');
    setCatalogError('');
    setSaveError('');
    setSuccess('');
    setShowConfirmation(false);
    try {
      const [snapshot, c, b, e] = await Promise.all([
        getResponsibleAssignments(responsibleUserId),
        listClients(),
        listBuildings(),
        listElevators(),
      ]);
      if (reqId !== requestRef.current) return;

      const buildingMap = new Map(b.map((bl) => [bl.id, bl]));
      const clientMap = new Map(c.map((cl) => [cl.id, cl]));
      const elevatorMap = new Map(e.map((el) => [el.id, el]));

      for (const id of snapshot.assigned_elevator_ids) {
        const el = elevatorMap.get(id);
        if (!el) {
          setCatalogError('No se pudo reconstruir el conjunto actual de asignaciones. Actualizá la página e intentá nuevamente.');
          setClients(c); setBuildings(b); setElevators(e);
          setLoading(false);
          return;
        }
        if (el.responsible_user_id !== responsibleUserId) {
          setCatalogError('No se pudo reconstruir el conjunto actual de asignaciones. Actualizá la página e intentá nuevamente.');
          setClients(c); setBuildings(b); setElevators(e);
          setLoading(false);
          return;
        }
        const bl = buildingMap.get(el.building_id);
        if (!bl) {
          setCatalogError('No se pudo reconstruir el conjunto actual de asignaciones. Actualizá la página e intentá nuevamente.');
          setClients(c); setBuildings(b); setElevators(e);
          setLoading(false);
          return;
        }
        const cl = clientMap.get(bl.client_id);
        if (!cl) {
          setCatalogError('No se pudo reconstruir el conjunto actual de asignaciones. Actualizá la página e intentá nuevamente.');
          setClients(c); setBuildings(b); setElevators(e);
          setLoading(false);
          return;
        }
        if (bl.client_id !== el.client_id) {
          setCatalogError('No se pudo reconstruir el conjunto actual de asignaciones. Actualizá la página e intentá nuevamente.');
          setClients(c); setBuildings(b); setElevators(e);
          setLoading(false);
          return;
        }
      }

      const assignedSet = new Set(snapshot.assigned_elevator_ids);
      setClients(c);
      setBuildings(b);
      setElevators(e);
      setOriginalAssignedIds(assignedSet);
      setSelectedElevatorIds(new Set(assignedSet));
      setStaleAssignments(false);
    } catch (err: unknown) {
      if (reqId !== requestRef.current) return;
      setLoadError(getAdminUsersErrorMessage(err));
    } finally {
      if (reqId === requestRef.current) setLoading(false);
    }
  }, [responsibleUserId]);

  useEffect(() => {
    loadData();
    return () => { requestRef.current++; };
  }, [loadData]);

  const buildingMap = new Map(buildings.map((b) => [b.id, b]));
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const editingBlocked = disabled || saving || staleAssignments || Boolean(loadError) || Boolean(catalogError);

  const viewData: ClientGroup[] = [];
  for (const client of [...clients].sort((a, b) => naturalSort.compare(a.name, b.name))) {
    const clientBuildings = buildings
      .filter((b) => b.client_id === client.id)
      .sort((a, b) => naturalSort.compare(a.name, b.name));
    const bGroups: BuildingGroup[] = [];
    for (const building of clientBuildings) {
      const bElevators = elevators
        .filter((e) => e.building_id === building.id)
        .sort((a, b) => {
          const codeCmp = naturalSort.compare(a.code, b.code);
          return codeCmp !== 0 ? codeCmp : a.id.localeCompare(b.id);
        })
        .map((e) => {
          const isCurrentlyAssigned = e.responsible_user_id === responsibleUserId;
          const bldg = buildingMap.get(e.building_id);
          const cli = bldg ? clientMap.get(bldg.client_id) : undefined;
          const isAvailable = e.active
            && !e.responsible_user_id
            && !!bldg && bldg.active
            && !!cli && cli.active
            && bldg.client_id === e.client_id;
          const isInactive = !e.active;
          return {
            elevator: e,
            building,
            client,
            isCurrentlyAssigned,
            isAvailable,
            isInactive,
            isSelected: selectedElevatorIds.has(e.id),
          };
        });
      const visible = bElevators.filter((v) => v.isCurrentlyAssigned || v.isAvailable);
      if (visible.length === 0) continue;
      const activeVisible = visible.filter((v) => !v.isInactive);
      const selectedActive = activeVisible.filter((v) => v.isSelected);
      bGroups.push({
        building,
        client,
        elevators: visible,
        allActiveSelected: activeVisible.length > 0 && selectedActive.length === activeVisible.length,
        activeCount: activeVisible.length,
        selectedCount: activeVisible.filter((v) => v.isSelected).length,
      });
    }
    if (bGroups.length > 0) {
      viewData.push({ client, buildings: bGroups });
    }
  }

  const originalArray = [...originalAssignedIds].sort();
  const selectedArray = [...selectedElevatorIds].sort();
  const addedIds = selectedArray.filter((id) => !originalAssignedIds.has(id));
  const removedIds = originalArray.filter((id) => !selectedElevatorIds.has(id));
  const hasChanges = addedIds.length > 0 || removedIds.length > 0;
  const hasInactiveSelected = [...selectedElevatorIds].some((id) => {
    const el = elevators.find((e) => e.id === id);
    return el && !el.active;
  });

  const validationMessage =
    hasChanges && selectedElevatorIds.size === 0
      ? 'Debe seleccionar al menos un ascensor'
      : selectedElevatorIds.size > 100
        ? 'No se pueden asignar más de 100 ascensores'
        : hasInactiveSelected
          ? 'Los ascensores inactivos no pueden conservarse asignados. Desmarcalos para continuar.'
          : '';

  const handleToggleElevator = (id: string) => {
    setSuccess('');
    setSaveError('');
    setShowConfirmation(false);
    setSelectedElevatorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleBuilding = (buildingId: string) => {
    setSuccess('');
    setSaveError('');
    setShowConfirmation(false);
    const bElevators = elevators
      .filter((e) => e.building_id === buildingId && (e.responsible_user_id === responsibleUserId || (e.active && !e.responsible_user_id)));
    const activeVisible = bElevators.filter((e) => e.active);
    const allActiveSelected = activeVisible.every((e) => selectedElevatorIds.has(e.id));
    setSelectedElevatorIds((prev) => {
      const next = new Set(prev);
      for (const e of bElevators) {
        if (e.active) {
          if (allActiveSelected) next.delete(e.id);
          else next.add(e.id);
        }
      }
      return next;
    });
  };

  const handleDiscard = () => {
    setSelectedElevatorIds(new Set(originalAssignedIds));
    setSaveError('');
    setSuccess('');
    setShowConfirmation(false);
  };

  const canSave = hasChanges && !hasInactiveSelected && !staleAssignments && !loading && !saving && !disabled && !catalogError && !loadError
    && selectedElevatorIds.size > 0 && selectedElevatorIds.size <= 100;

  const handleSave = async () => {
    if (!canSave || saveRef.current) return;
    saveRef.current = true;
    setSaving(true);
    onSavingChange?.(true);
    setSaveError('');
    try {
      const elevatorIds = [...viewData]
        .flatMap((cg) => cg.buildings.flatMap((bg) => bg.elevators
          .filter((v) => v.isSelected)
          .sort((a, b) => {
            const codeCmp = naturalSort.compare(a.elevator.code, b.elevator.code);
            return codeCmp !== 0 ? codeCmp : a.elevator.id.localeCompare(b.elevator.id);
          })
          .map((v) => v.elevator.id),
        ));

      if (elevatorIds.length !== selectedElevatorIds.size || new Set(elevatorIds).size !== elevatorIds.length) {
        setSaveError('Inconsistencia en la selección de ascensores. Actualizá la página e intentá nuevamente.');
        saveRef.current = false;
        setSaving(false);
        onSavingChange?.(false);
        return;
      }

      const result = await replaceResponsibleAssignments({
        responsible_user_id: responsibleUserId,
        elevator_ids: elevatorIds,
        expected_current_elevator_ids: originalArray,
      });

      const newAssignedSet = new Set(result.assigned_elevator_ids);
      const removedSet = new Set(result.removed_elevator_ids);

      setElevators((prev) => prev.map((el) => {
        if (newAssignedSet.has(el.id) && el.responsible_user_id !== responsibleUserId) {
          return { ...el, responsible_user_id: responsibleUserId };
        }
        if (removedSet.has(el.id) && el.responsible_user_id === responsibleUserId) {
          return { ...el, responsible_user_id: undefined };
        }
        return el;
      }));

      setOriginalAssignedIds(newAssignedSet);
      setSelectedElevatorIds(new Set(newAssignedSet));
      setShowConfirmation(false);
      setSuccess(`Asignaciones actualizadas correctamente: ${result.added_elevator_ids.length} agregadas y ${result.removed_elevator_ids.length} retiradas.`);
    } catch (err: unknown) {
      const msg = getAdminUsersErrorMessage(err);
      if (msg === 'Las asignaciones cambiaron. Actualizá la página e intentá nuevamente') {
        setStaleAssignments(true);
      }
      setSaveError(msg);
    } finally {
      saveRef.current = false;
      setSaving(false);
      onSavingChange?.(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><h3 className="font-semibold">Asignaciones de edificios y ascensores</h3></CardHeader>
        <CardContent>
          <div className="flex justify-center py-6" aria-busy="true" aria-label="Cargando asignaciones">
            <div className="w-6 h-6 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><h3 className="font-semibold">Asignaciones de edificios y ascensores</h3></CardHeader>
      <CardContent className="space-y-4" aria-busy={saving}>
        {loadError && (
          <div className="space-y-2">
            <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {loadError}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={loadData} disabled={saving}>Reintentar carga de asignaciones</Button>
          </div>
        )}

        {catalogError && (
          <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {catalogError}
          </div>
        )}

        {saveError && (
          <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {saveError}
          </div>
        )}

        {success && (
          <div role="status" className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2">
            <Check size={16} /> {success}
          </div>
        )}

        {staleAssignments && (
          <div className="space-y-2">
            <div role="note" className="p-3 bg-warning/10 border border-warning/30 rounded text-warning text-sm">
              Las asignaciones cambiaron. Actualizá la página e intentá nuevamente.
            </div>
            <Button type="button" variant="outline" size="sm" onClick={loadData} disabled={saving}>
              <RefreshCw size={14} className="mr-1" /> Actualizar asignaciones
            </Button>
          </div>
        )}

        <p className="text-xs text-gray-500">Los ascensores asignados a otros responsables no se muestran como disponibles.</p>

        {viewData.length === 0 && !loadError && (
          <p className="text-sm text-gray-500">No hay ascensores para mostrar.</p>
        )}

        {viewData.map((cg) => (
          <div key={cg.client.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-medium text-gray-900">{cg.client.name}</span>
              {cg.client.code && <span className="text-xs text-gray-500">({cg.client.code})</span>}
              {!cg.client.active && <Badge variant="danger">Inactivo</Badge>}
            </div>
            {cg.buildings.map((bg) => (
              <div key={bg.building.id} className="ml-4 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id={`building-${bg.building.id}`}
                    checked={bg.allActiveSelected}
                    onChange={() => handleToggleBuilding(bg.building.id)}
                    disabled={editingBlocked || bg.activeCount === 0}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <label htmlFor={`building-${bg.building.id}`} className="text-sm font-medium text-gray-800 cursor-pointer">
                    Seleccionar todos los ascensores de {bg.building.name}
                    {bg.building.address ? ` — ${bg.building.address}` : ''}
                  </label>
                  {!bg.building.active && <Badge variant="danger">Inactivo</Badge>}
                  <span className="text-xs text-gray-500">{bg.selectedCount} de {bg.activeCount} seleccionados</span>
                </div>
                <div className="ml-6 space-y-1">
                  {bg.elevators.map((v) => (
                    <label key={v.elevator.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={v.isSelected}
                        onChange={() => handleToggleElevator(v.elevator.id)}
                        disabled={editingBlocked || (v.isInactive && !v.isSelected) || (!v.isCurrentlyAssigned && !v.isAvailable)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className={v.isInactive && v.isCurrentlyAssigned ? 'text-gray-400' : 'text-gray-700'}>
                        Ascensor {v.elevator.code}
                        {v.elevator.manufacturer ? ` — ${v.elevator.manufacturer}` : ''}
                        {v.elevator.model ? ` ${v.elevator.model}` : ''}
                      </span>
                      {v.isInactive && v.isCurrentlyAssigned && <Badge variant="warning">Inactivo</Badge>}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
          <div><span className="text-gray-500">Asignados actualmente: </span><span className="font-medium">{originalAssignedIds.size}</span></div>
          <div><span className="text-gray-500">Seleccionados: </span><span className="font-medium">{selectedElevatorIds.size}</span></div>
          <div><span className="text-gray-500">Se agregarán: </span><span className="font-medium">{addedIds.length}</span></div>
          <div><span className="text-gray-500">Se retirarán: </span><span className="font-medium">{removedIds.length}</span></div>
        </div>

        {validationMessage && (
          <div role="alert" className="p-3 bg-warning/10 border border-warning/30 rounded text-warning text-sm">
            {validationMessage}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleDiscard} disabled={!hasChanges || saving}>Descartar cambios</Button>
          <Button type="button" size="sm" onClick={() => setShowConfirmation(true)} disabled={!canSave}>Guardar asignaciones</Button>
        </div>

        {showConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div role="dialog" aria-modal="true" aria-labelledby="confirm-assignment-title" className="bg-white rounded-xl max-w-lg w-full p-6">
              <h3 id="confirm-assignment-title" className="text-lg font-semibold mb-4">Confirmar cambios de asignación</h3>
              <div className="space-y-2 text-sm mb-4">
                <p>Responsable: <span className="font-medium">{responsibleUserId}</span></p>
                <p>Ascensores finales: <span className="font-medium">{selectedElevatorIds.size}</span></p>
                <p>Agregados: <span className="font-medium">{addedIds.length}</span></p>
                <p>Retirados: <span className="font-medium">{removedIds.length}</span></p>
              </div>
              {addedIds.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Se agregarán:</p>
                  <div className="max-h-40 overflow-y-auto text-sm space-y-1">
                    {addedIds.map((id) => {
                      const el = elevators.find((e) => e.id === id);
                      const b = el ? buildingMap.get(el.building_id) : undefined;
                      const c = b ? clientMap.get(b.client_id) : undefined;
                      return <div key={id} className="text-gray-600">Ascensor {el?.code} — {b?.name} ({c?.name})</div>;
                    })}
                  </div>
                </div>
              )}
              {addedIds.length === 0 && <p className="text-sm text-gray-500 mb-3">No se agregarán ascensores.</p>}
              {removedIds.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Se retirarán:</p>
                  <div className="max-h-40 overflow-y-auto text-sm space-y-1">
                    {removedIds.map((id) => {
                      const el = elevators.find((e) => e.id === id);
                      const b = el ? buildingMap.get(el.building_id) : undefined;
                      const c = b ? clientMap.get(b.client_id) : undefined;
                      return <div key={id} className="text-gray-600">Ascensor {el?.code} — {b?.name} ({c?.name})</div>;
                    })}
                  </div>
                </div>
              )}
              {removedIds.length === 0 && <p className="text-sm text-gray-500 mb-3">No se retirarán ascensores.</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowConfirmation(false)} disabled={saving}>Cancelar</Button>
                <Button type="button" size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Confirmar cambios'}</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
