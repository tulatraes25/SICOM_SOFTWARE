import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServiceRecordForm from './ServiceRecordForm';

const mocks = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockParams: { elevatorId: 'e1', id: undefined as string | undefined },
  mockGetElevatorById: vi.fn(),
  mockGetServiceRecordById: vi.fn(),
  mockCreateServiceRecord: vi.fn(),
  mockUpdateServiceRecord: vi.fn(),
  mockSubmitServiceRecord: vi.fn(),
  mockCreateChecklistItems: vi.fn(),
  mockDeleteChecklistByServiceRecord: vi.fn(),
}));

vi.mock('@/services/serviceRecords.service', () => ({
  getServiceRecordById: (...a: unknown[]) => mocks.mockGetServiceRecordById(...a),
  createServiceRecord: (...a: unknown[]) => mocks.mockCreateServiceRecord(...a),
  updateServiceRecord: (...a: unknown[]) => mocks.mockUpdateServiceRecord(...a),
  submitServiceRecord: (...a: unknown[]) => mocks.mockSubmitServiceRecord(...a),
  createChecklistItems: (...a: unknown[]) => mocks.mockCreateChecklistItems(...a),
  deleteChecklistByServiceRecord: (...a: unknown[]) => mocks.mockDeleteChecklistByServiceRecord(...a),
}));

vi.mock('@/services/elevators.service', () => ({
  getElevatorById: (...a: unknown[]) => mocks.mockGetElevatorById(...a),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.mockNavigate,
    useParams: () => mocks.mockParams,
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'tech-1' } }),
}));

vi.mock('@/components/service/ServicePhotoUpload', () => ({
  default: vi.fn(() => <div data-testid="photo-upload" />),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/service/ServiceChecklist', () => {
  const DEFAULT_ITEMS = [
    'Estado de puertas',
    'Botonera de cabina',
    'Botoneras de piso',
    'Nivelación',
    'Iluminación de cabina',
    'Sala de máquinas',
    'Sistema de freno',
    'Ruidos o vibraciones',
    'Limpieza general',
    'Seguridad general',
  ];

  function createDefaultChecklist() {
    return DEFAULT_ITEMS.map((item_name) => ({
      item_name,
      status: 'ok' as const,
      notes: '',
    }));
  }

  return {
    __esModule: true,
    default: ({
      items,
      onChange,
    }: {
      items: Array<{ item_name: string; status: string; notes: string }>;
      onChange: (items: Array<{ item_name: string; status: string; notes: string }>) => void;
    }) => (
      <div data-testid="service-checklist">
        {items.map((item) => (
          <div key={item.item_name} data-testid="checklist-item">
            <span>{item.item_name}</span>
            <span data-testid={`status-${item.item_name}`}>{item.status}</span>
            {item.notes && <span data-testid={`note-${item.item_name}`}>{item.notes}</span>}
            <button
              data-testid={`toggle-${item.item_name}`}
              onClick={() =>
                onChange(
                  items.map((i) =>
                    i.item_name === item.item_name ? { ...i, status: 'needs_attention' } : i,
                  ),
                )
              }
            >
              toggle
            </button>
            <button
              data-testid={`add-note-${item.item_name}`}
              onClick={() =>
                onChange(
                  items.map((i) =>
                    i.item_name === item.item_name ? { ...i, notes: 'Nota de prueba' } : i,
                  ),
                )
              }
            >
              add note
            </button>
          </div>
        ))}
      </div>
    ),
    createDefaultChecklist,
  };
});

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/services/audit.service', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

function makeElevator(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    code: 'ASC-0001',
    operational_status: 'operativo',
    conservation_status: 'conforme',
    building: {
      id: 'b1',
      name: 'Edificio Central',
      address: 'Av. Test 123',
    },
    ...overrides,
  };
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    elevator_id: 'e1',
    technician_id: 'tech-1',
    service_date: '2026-08-03',
    service_type: 'preventivo',
    status: 'draft',
    operational_status_at_service: 'operativo',
    conservation_status_at_service: 'conforme',
    description: '',
    observations: '',
    technical_report: '',
    checklist: [],
    photos: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockParams.elevatorId = 'e1';
  mocks.mockParams.id = undefined;
  mocks.mockGetElevatorById.mockResolvedValue(makeElevator());
  mocks.mockCreateChecklistItems.mockResolvedValue(undefined);
  mocks.mockDeleteChecklistByServiceRecord.mockResolvedValue(undefined);
  mocks.mockGetServiceRecordById.mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

function renderCreationForm() {
  return render(
    <MemoryRouter initialEntries={['/tecnico/ascensores/e1/mantenimiento/nuevo']}>
      <ServiceRecordForm />
    </MemoryRouter>,
  );
}

function renderEditForm(recordOverrides: Record<string, unknown> = {}) {
  const record = makeRecord(recordOverrides);
  mocks.mockParams.id = record.id;
  mocks.mockParams.elevatorId = 'e1';
  mocks.mockGetServiceRecordById.mockResolvedValue(record);
  mocks.mockGetElevatorById.mockResolvedValue(
    makeElevator({ id: record.elevator_id }),
  );

  return render(
    <MemoryRouter
      initialEntries={['/tecnico/ascensores/e1/mantenimiento/r1/editar']}
    >
      <ServiceRecordForm />
    </MemoryRouter>,
  );
}

// ─── CREATION MODE ────────────────────────────────────────────────

describe('ServiceRecordForm — Modo creación: carga', () => {
  it('carga el ascensor indicado por la ruta', async () => {
    renderCreationForm();
    await waitFor(() => {
      expect(mocks.mockGetElevatorById).toHaveBeenCalledWith('e1');
    });
  });

  it('muestra código del ascensor', async () => {
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
  });

  it('muestra edificio', async () => {
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText(/Edificio Central/)).toBeInTheDocument();
    });
  });
});

describe('ServiceRecordForm — Modo creación: fecha', () => {
  it('usa getLocalDateInputValue (fecha inicial es YYYY-MM-DD)', async () => {
    const expectedDate = new Date().toISOString().split('T')[0];
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    const dateInput = screen.getByLabelText(/Fecha del servicio/i);
    expect(dateInput).toHaveValue(expectedDate);
  });

  it('no desplaza la fecha al día UTC siguiente', async () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    const dateInput = screen.getByLabelText(/Fecha del servicio/i);
    expect(dateInput).toHaveValue(expected);
  });
});

describe('ServiceRecordForm — Modo creación: tipo por defecto', () => {
  it('muestra tipo Preventivo por defecto', async () => {
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    const typeSelect = screen.getByLabelText(/Tipo de servicio/i);
    expect(typeSelect).toHaveValue('preventivo');
  });
});

describe('ServiceRecordForm — Modo creación: checklist', () => {
  it('checklist inicial contiene 10 ítems', async () => {
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    const items = screen.getAllByTestId('checklist-item');
    expect(items).toHaveLength(10);
  });

  it('los 10 comienzan en OK', async () => {
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    const statuses = screen.getAllByTestId(/^status-/);
    statuses.forEach((el) => {
      expect(el).toHaveTextContent('ok');
    });
  });

  it('permite cambiar un ítem', async () => {
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('toggle-Estado de puertas'));
    const status = screen.getByTestId('status-Estado de puertas');
    expect(status).toHaveTextContent('needs_attention');
  });

  it('permite agregar una nota', async () => {
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('add-note-Estado de puertas'));
    expect(screen.getByTestId('note-Estado de puertas')).toHaveTextContent('Nota de prueba');
  });
});

describe('ServiceRecordForm — Modo creación: creación', () => {
  it('crea el mantenimiento con technician_id del usuario', async () => {
    mocks.mockCreateServiceRecord.mockResolvedValue({ id: 'r-new' });
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Borrador/i }));
    await waitFor(() => {
      expect(mocks.mockCreateServiceRecord).toHaveBeenCalledWith(
        expect.objectContaining({ technician_id: 'tech-1' }),
      );
    });
  });

  it('crea el mantenimiento como borrador', async () => {
    mocks.mockCreateServiceRecord.mockResolvedValue({ id: 'r-new' });
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Borrador/i }));
    await waitFor(() => {
      expect(mocks.mockCreateServiceRecord).toHaveBeenCalledWith(
        expect.objectContaining({ elevator_id: 'e1' }),
      );
    });
  });

  it('después de crear inserta 10 ítems de checklist', async () => {
    mocks.mockCreateServiceRecord.mockResolvedValue({ id: 'r-new' });
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Borrador/i }));
    await waitFor(() => {
      expect(mocks.mockCreateChecklistItems).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ service_record_id: 'r-new', item_name: 'Estado de puertas' }),
        ]),
      );
    });
    const call = mocks.mockCreateChecklistItems.mock.calls[0];
    expect(call[0]).toHaveLength(10);
  });
});

describe('ServiceRecordForm — Modo creación: fotos', () => {
  it('"Guardar y agregar fotos" guarda sin abandonar la pantalla', async () => {
    mocks.mockCreateServiceRecord.mockResolvedValue({ id: 'r-new' });
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar y agregar fotos/i }));
    await waitFor(() => {
      expect(mocks.mockCreateServiceRecord).toHaveBeenCalled();
    });
    expect(mocks.mockNavigate).not.toHaveBeenCalled();
  });

  it('después de guardar muestra la sección de fotografías', async () => {
    mocks.mockCreateServiceRecord.mockResolvedValue({ id: 'r-new' });
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar y agregar fotos/i }));
    await waitFor(() => {
      expect(screen.getByTestId('photo-upload')).toBeInTheDocument();
    });
  });
});

describe('ServiceRecordForm — Modo creación: borrador y navegación', () => {
  it('"Guardar borrador" navega al panel técnico', async () => {
    mocks.mockCreateServiceRecord.mockResolvedValue({ id: 'r-new' });
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Borrador/i }));
    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith('/tecnico');
    });
  });
});

describe('ServiceRecordForm — Modo creación: envío a revisión', () => {
  it('antes de guardar no permite enviar a revisión', async () => {
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Enviar a Revisión/i })).not.toBeInTheDocument();
  });

  it('después de guardar permite enviar', async () => {
    mocks.mockCreateServiceRecord.mockResolvedValue({ id: 'r-new' });
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar y agregar fotos/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enviar a Revisión/i })).toBeInTheDocument();
    });
  });

  it('cancelar confirmación no envía', async () => {
    mocks.mockCreateServiceRecord.mockResolvedValue({ id: 'r-new' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar y agregar fotos/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enviar a Revisión/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Enviar a Revisión/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(mocks.mockSubmitServiceRecord).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('aceptar confirmación llama submitServiceRecord', async () => {
    mocks.mockCreateServiceRecord.mockResolvedValue({ id: 'r-new' });
    mocks.mockSubmitServiceRecord.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar y agregar fotos/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enviar a Revisión/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Enviar a Revisión/i }));
    await waitFor(() => {
      expect(mocks.mockSubmitServiceRecord).toHaveBeenCalledWith('r-new');
    });
  });

  it('envío correcto navega al panel', async () => {
    mocks.mockCreateServiceRecord.mockResolvedValue({ id: 'r-new' });
    mocks.mockSubmitServiceRecord.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar y agregar fotos/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enviar a Revisión/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Enviar a Revisión/i }));
    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith('/tecnico');
    });
  });
});

describe('ServiceRecordForm — Modo creación: errores', () => {
  it('error de creación se muestra', async () => {
    mocks.mockCreateServiceRecord.mockRejectedValue(new Error('Error al crear'));
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Borrador/i }));
    await waitFor(() => {
      expect(screen.getByText('Error al crear')).toBeInTheDocument();
    });
  });
});

describe('ServiceRecordForm — Modo creación: doble clic', () => {
  it('doble clic durante saving produce una sola creación', async () => {
    let resolveCreate!: (value: { id: string }) => void;
    mocks.mockCreateServiceRecord.mockImplementation(
      () => new Promise((r) => { resolveCreate = r; }),
    );
    renderCreationForm();
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Borrador/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar Borrador/i }));
    resolveCreate({ id: 'r-new' });
    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith('/tecnico');
    });
    expect(mocks.mockCreateServiceRecord).toHaveBeenCalledTimes(1);
  });
});

// ─── EDIT MODE ────────────────────────────────────────────────────

describe('ServiceRecordForm — Modo edición: carga', () => {
  it('carga el registro existente', async () => {
    renderEditForm({ id: 'r-edit' });
    await waitFor(() => {
      expect(mocks.mockGetServiceRecordById).toHaveBeenCalledWith('r-edit');
    });
  });

  it('carga checklist existente', async () => {
    const existingChecklist = [
      { item_name: 'Estado de puertas', status: 'ok', notes: '' },
      { item_name: 'Botonera de cabina', status: 'needs_attention', notes: 'Falla' },
    ];
    renderEditForm({ checklist: existingChecklist });
    await waitFor(() => {
      expect(mocks.mockGetServiceRecordById).toHaveBeenCalled();
    });
    expect(screen.getByText('Estado de puertas')).toBeInTheDocument();
    expect(screen.getByText('Botonera de cabina')).toBeInTheDocument();
  });

  it('carga fotografías existentes', async () => {
    renderEditForm({
      photos: [{ id: 'p1', storage_path: 'r1/photo.jpg', photo_type: 'general' }],
    });
    await waitFor(() => {
      expect(mocks.mockGetServiceRecordById).toHaveBeenCalled();
    });
    expect(screen.getByTestId('photo-upload')).toBeInTheDocument();
  });
});

describe('ServiceRecordForm — Modo edición: actualización', () => {
  it('actualiza por ID', async () => {
    mocks.mockUpdateServiceRecord.mockResolvedValue({});
    renderEditForm({ id: 'r-edit' });
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Borrador/i }));
    await waitFor(() => {
      expect(mocks.mockUpdateServiceRecord).toHaveBeenCalledWith('r-edit', expect.anything());
    });
  });

  it('elimina checklist anterior', async () => {
    mocks.mockUpdateServiceRecord.mockResolvedValue({});
    renderEditForm({ id: 'r-edit' });
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Borrador/i }));
    await waitFor(() => {
      expect(mocks.mockDeleteChecklistByServiceRecord).toHaveBeenCalledWith('r-edit');
    });
  });

  it('recrea el checklist actualizado', async () => {
    mocks.mockUpdateServiceRecord.mockResolvedValue({});
    renderEditForm({ id: 'r-edit' });
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Borrador/i }));
    await waitFor(() => {
      expect(mocks.mockCreateChecklistItems).toHaveBeenCalled();
    });
  });
});

describe('ServiceRecordForm — Modo edición: permisos por estado', () => {
  it('un registro submitted permite guardar (el componente no bloquea edición)', async () => {
    mocks.mockGetServiceRecordById.mockResolvedValue(
      makeRecord({ status: 'submitted' }),
    );
    mocks.mockGetElevatorById.mockResolvedValue(makeElevator());
    mocks.mockUpdateServiceRecord.mockResolvedValue({});
    mocks.mockParams.id = 'r-submitted';
    render(
      <MemoryRouter
        initialEntries={['/tecnico/ascensores/e1/mantenimiento/r-submitted/editar']}
      >
        <ServiceRecordForm />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    const draftButton = screen.getByRole('button', { name: /Guardar Borrador/i });
    expect(draftButton).not.toBeDisabled();
  });

  it('un registro approved permite guardar (el componente no bloquea edición)', async () => {
    mocks.mockGetServiceRecordById.mockResolvedValue(
      makeRecord({ status: 'approved' }),
    );
    mocks.mockGetElevatorById.mockResolvedValue(makeElevator());
    mocks.mockUpdateServiceRecord.mockResolvedValue({});
    mocks.mockParams.id = 'r-approved';
    render(
      <MemoryRouter
        initialEntries={['/tecnico/ascensores/e1/mantenimiento/r-approved/editar']}
      >
        <ServiceRecordForm />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    const draftButton = screen.getByRole('button', { name: /Guardar Borrador/i });
    expect(draftButton).not.toBeDisabled();
  });

  it('un registro rejected permite corregir', async () => {
    mocks.mockGetServiceRecordById.mockResolvedValue(
      makeRecord({ status: 'rejected' }),
    );
    mocks.mockGetElevatorById.mockResolvedValue(makeElevator());
    mocks.mockUpdateServiceRecord.mockResolvedValue({});
    mocks.mockParams.id = 'r-rejected';
    render(
      <MemoryRouter
        initialEntries={['/tecnico/ascensores/e1/mantenimiento/r-rejected/editar']}
      >
        <ServiceRecordForm />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    const draftButton = screen.getByRole('button', { name: /Guardar Borrador/i });
    expect(draftButton).not.toBeDisabled();
    fireEvent.click(draftButton);
    await waitFor(() => {
      expect(mocks.mockUpdateServiceRecord).toHaveBeenCalled();
    });
  });
});
