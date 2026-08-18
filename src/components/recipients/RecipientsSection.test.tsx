import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RecipientsSection from './RecipientsSection';

const { mockListBuildingRecipients, mockCreateBuildingRecipient, mockUpdateBuildingRecipient, mockDeactivateBuildingRecipient } = vi.hoisted(() => ({
  mockListBuildingRecipients: vi.fn(),
  mockCreateBuildingRecipient: vi.fn(),
  mockUpdateBuildingRecipient: vi.fn(),
  mockDeactivateBuildingRecipient: vi.fn(),
}));

vi.mock('@/services/buildingRecipients.service', () => ({
  listBuildingRecipients: (...a: unknown[]) => mockListBuildingRecipients(...a),
  createBuildingRecipient: (...a: unknown[]) => mockCreateBuildingRecipient(...a),
  updateBuildingRecipient: (...a: unknown[]) => mockUpdateBuildingRecipient(...a),
  deactivateBuildingRecipient: (...a: unknown[]) => mockDeactivateBuildingRecipient(...a),
}));

function renderWithParentForm() {
  const handleSubmit = vi.fn((e) => e.preventDefault());
  render(
    <form onSubmit={handleSubmit}>
      <RecipientsSection buildingId="b1" elevators={[]} />
    </form>
  );
  return { handleSubmit };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListBuildingRecipients.mockResolvedValue([]);
  mockCreateBuildingRecipient.mockResolvedValue({ id: 'new-1' });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('RecipientsSection — botones no envían formulario padre', () => {
  it('Nuevo abre formulario y NO envía el form padre', async () => {
    const { handleSubmit } = renderWithParentForm();
    await waitFor(() => {
      expect(screen.getByText('Destinatarios')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Nuevo/));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Nombre/)).toBeInTheDocument();
    });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('Cancelar cierra formulario y NO envía el form padre', async () => {
    const { handleSubmit } = renderWithParentForm();
    await waitFor(() => {
      expect(screen.getByText('Destinatarios')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Nuevo/));
    await waitFor(() => {
      expect(screen.getByLabelText(/^Nombre/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancelar'));

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('Guardar destinatario NO envía el form padre', async () => {
    const { handleSubmit } = renderWithParentForm();
    await waitFor(() => {
      expect(screen.getByText('Destinatarios')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Nuevo/));
    await waitFor(() => {
      expect(screen.getByLabelText(/^Nombre/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/^Correo/), { target: { value: 'juan@test.com' } });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockCreateBuildingRecipient).toHaveBeenCalledTimes(1);
    });

    expect(handleSubmit).not.toHaveBeenCalled();
  });
});

describe('RecipientsSection — botones de lista no envían formulario padre', () => {
  it('Editar destinatario NO envía el form padre', async () => {
    mockListBuildingRecipients.mockResolvedValue([
      {
        id: 'r1', building_id: 'b1', full_name: 'Test User', email: 'test@test.com',
        phone: '', role_label: '', elevator_id: null,
        receives_service_orders: true, receives_monthly_reports: true,
        active: true, created_at: '', updated_at: '',
      },
    ]);

    const { handleSubmit } = renderWithParentForm();
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    const row = screen.getByText('Test User').closest('.border')!;
    const editButton = within(row as HTMLElement).getAllByRole('button')[0];
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('Desactivar destinatario NO envía el form padre', async () => {
    mockListBuildingRecipients.mockResolvedValue([
      {
        id: 'r1', building_id: 'b1', full_name: 'Test User', email: 'test@test.com',
        phone: '', role_label: '', elevator_id: null,
        receives_service_orders: true, receives_monthly_reports: true,
        active: true, created_at: '', updated_at: '',
      },
    ]);

    const { handleSubmit } = renderWithParentForm();
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    const row = screen.getByText('Test User').closest('.border')!;
    const buttons = within(row as HTMLElement).getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(mockDeactivateBuildingRecipient).toHaveBeenCalledWith('r1');
    });

    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
