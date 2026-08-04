import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ServiceChecklist, { createDefaultChecklist } from './ServiceChecklist';

vi.mock('lucide-react', () => ({
  CheckCircle: (props: Record<string, unknown>) => <svg data-testid="icon-check" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="icon-alert" {...props} />,
  XCircle: (props: Record<string, unknown>) => <svg data-testid="icon-x" {...props} />,
  Minus: (props: Record<string, unknown>) => <svg data-testid="icon-minus" {...props} />,
}));

interface ChecklistItem {
  item_name: string;
  status: 'ok' | 'needs_attention' | 'failed' | 'na';
  notes: string;
}

const defaultItems: ChecklistItem[] = [
  { item_name: 'Estado de puertas', status: 'ok', notes: '' },
  { item_name: 'Botonera de cabina', status: 'ok', notes: '' },
  { item_name: 'Botoneras de piso', status: 'ok', notes: '' },
  { item_name: 'Nivelación', status: 'ok', notes: '' },
  { item_name: 'Iluminación de cabina', status: 'ok', notes: '' },
  { item_name: 'Sala de máquinas', status: 'ok', notes: '' },
  { item_name: 'Sistema de freno', status: 'ok', notes: '' },
  { item_name: 'Ruidos o vibraciones', status: 'ok', notes: '' },
  { item_name: 'Limpieza general', status: 'ok', notes: '' },
  { item_name: 'Seguridad general', status: 'ok', notes: '' },
];

function makeItems(overrides?: Partial<ChecklistItem>[]): ChecklistItem[] {
  return defaultItems.map((item, i) => ({
    ...item,
    ...(overrides?.[i] ?? {}),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('ServiceChecklist — Render', () => {
  it('renderiza los 10 ítems', () => {
    render(<ServiceChecklist items={makeItems()} onChange={vi.fn()} />);
    expect(screen.getAllByText(/Estado de puertas|Botonera de cabina|Botoneras de piso|Nivelación|Iluminación de cabina|Sala de máquinas|Sistema de freno|Ruidos o vibraciones|Limpieza general|Seguridad general/)).toHaveLength(10);
  });

  it('estado OK por defecto', () => {
    render(<ServiceChecklist items={makeItems()} onChange={vi.fn()} />);
    const allIcons = screen.getAllByTestId('icon-check');
    expect(allIcons.length).toBeGreaterThanOrEqual(10);
  });
});

describe('ServiceChecklist — Cambio de estado', () => {
  it('cambio a Observado actualiza el ítem', () => {
    const onChange = vi.fn();
    render(<ServiceChecklist items={makeItems()} onChange={onChange} />);
    const observadoBtns = screen.getAllByTitle('Observado');
    fireEvent.click(observadoBtns[0]!);
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ item_name: 'Estado de puertas', status: 'needs_attention' }),
      ]),
    );
  });

  it('cambio a Requiere intervención', () => {
    const onChange = vi.fn();
    render(<ServiceChecklist items={makeItems()} onChange={onChange} />);
    const btns = screen.getAllByTitle('Requiere intervención');
    fireEvent.click(btns[0]!);
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ item_name: 'Estado de puertas', status: 'failed' }),
      ]),
    );
  });

  it('cambio a No aplica', () => {
    const onChange = vi.fn();
    render(<ServiceChecklist items={makeItems()} onChange={onChange} />);
    const btns = screen.getAllByTitle('No aplica');
    fireEvent.click(btns[0]!);
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ item_name: 'Estado de puertas', status: 'na' }),
      ]),
    );
  });

  it('cambio actualiza únicamente el ítem seleccionado', () => {
    const onChange = vi.fn();
    render(<ServiceChecklist items={makeItems()} onChange={onChange} />);
    const observadoBtns = screen.getAllByTitle('Observado');
    fireEvent.click(observadoBtns[2]!);
    const calledItems = onChange.mock.calls[0]![0] as ChecklistItem[];
    expect(calledItems[0]!.status).toBe('ok');
    expect(calledItems[1]!.status).toBe('ok');
    expect(calledItems[2]!.status).toBe('needs_attention');
  });
});

describe('ServiceChecklist — Notas', () => {
  it('nota se guarda en el ítem correcto', () => {
    const onChange = vi.fn();
    render(<ServiceChecklist items={makeItems()} onChange={onChange} />);
    const expandBtns = screen.getAllByText('➕');
    fireEvent.click(expandBtns[0]!);
    const textarea = screen.getByPlaceholderText('Observaciones opcionales...');
    fireEvent.change(textarea, { target: { value: 'Puertas con desgaste' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ item_name: 'Estado de puertas', notes: 'Puertas con desgaste' }),
      ]),
    );
  });

  it('expandir y cerrar notas', () => {
    render(<ServiceChecklist items={makeItems()} onChange={vi.fn()} />);
    expect(screen.queryByPlaceholderText('Observaciones opcionales...')).not.toBeInTheDocument();
    const expandBtns = screen.getAllByText('➕');
    fireEvent.click(expandBtns[0]!);
    expect(screen.getByPlaceholderText('Observaciones opcionales...')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('➕')[0]!);
    expect(screen.queryByPlaceholderText('Observaciones opcionales...')).not.toBeInTheDocument();
  });
});

describe('ServiceChecklist — readOnly', () => {
  it('readOnly no permite cambiar estado', () => {
    const onChange = vi.fn();
    render(<ServiceChecklist items={makeItems()} onChange={onChange} readOnly />);
    expect(screen.queryByTitle('OK')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Observado')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Requiere intervención')).not.toBeInTheDocument();
    expect(screen.queryByTitle('No aplica')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('readOnly muestra etiqueta traducida', () => {
    render(<ServiceChecklist items={makeItems([{ status: 'needs_attention' }])} onChange={vi.fn()} readOnly />);
    expect(screen.getByText('Observado')).toBeInTheDocument();
  });
});

describe('createDefaultChecklist', () => {
  it('devuelve objetos independientes', () => {
    const a = createDefaultChecklist();
    const b = createDefaultChecklist();
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
  });

  it('no muta el arreglo original', () => {
    const a = createDefaultChecklist();
    a[0]!.notes = 'modificado';
    a[0]!.status = 'failed';
    const b = createDefaultChecklist();
    expect(b[0]!.notes).toBe('');
    expect(b[0]!.status).toBe('ok');
  });
});
