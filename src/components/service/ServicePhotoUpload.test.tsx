import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ServicePhotoUpload from './ServicePhotoUpload';
import type { ServicePhoto } from '@/types/database';

const { mockSupabaseFrom, mockSupabaseStorageFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
  mockSupabaseStorageFrom: vi.fn(),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    storage: { from: (...args: unknown[]) => mockSupabaseStorageFrom(...args) },
  },
}));

vi.mock('@/lib/storagePaths', () => ({
  buildServicePhotoPath: (id: string, ext: string) => `${id}/photo.${ext}`,
  BUCKET_NAME: 'service-photos',
}));

function makePhoto(overrides: Partial<ServicePhoto> = {}): ServicePhoto {
  return {
    id: `p-${Math.random().toString(36).slice(2, 8)}`,
    service_record_id: 'sr-1',
    storage_path: 'service-records/sr-1/photo.jpg',
    photo_type: 'general',
    include_in_report: false,
    report_order: 0,
    created_at: '2026-08-03T10:00:00Z',
    ...overrides,
  };
}

function makeFile(name: string, size: number, type = 'image/jpeg'): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

function setupFromChain(selectReturn: { data: unknown; error: null } = { data: null, error: null }) {
  const mockSingle = vi.fn().mockResolvedValue(selectReturn);
  const mockEqForSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockSelectForSelect = vi.fn().mockReturnValue({ eq: mockEqForSelect });
  const mockEqForDelete = vi.fn().mockResolvedValue({ error: null });
  const mockDelete = vi.fn().mockReturnValue({ eq: mockEqForDelete });
  const mockInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });

  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'service_photos') {
      return {
        select: mockSelectForSelect,
        insert: mockInsert,
        delete: mockDelete,
      };
    }
    return {};
  });

  return { mockSingle, mockEqForSelect, mockSelectForSelect, mockEqForDelete, mockDelete, mockInsert };
}

function setupStorageFromChain(uploadError: { message: string } | null = null) {
  const mockUpload = vi.fn().mockResolvedValue({ error: uploadError });
  const mockRemove = vi.fn().mockResolvedValue({ error: null });
  const mockCreateSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/photo.jpg' } });

  mockSupabaseStorageFrom.mockReturnValue({
    upload: mockUpload,
    remove: mockRemove,
    createSignedUrl: mockCreateSignedUrl,
  });

  return { mockUpload, mockRemove, mockCreateSignedUrl };
}

function getFileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]')!;
}

beforeEach(() => {
  vi.clearAllMocks();
  setupStorageFromChain();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('ServicePhotoUpload — Render', () => {
  it('renderiza fotografías existentes', () => {
    const photos = [makePhoto({ id: 'p1', photo_type: 'before' }), makePhoto({ id: 'p2', photo_type: 'after' })];
    setupFromChain({ data: { storage_path: null }, error: null });
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={photos} onPhotosChange={vi.fn()} />);
    expect(getFileInput(container)).toBeInTheDocument();
    expect(screen.getByText('Fotos (2/10)')).toBeInTheDocument();
  });

  it('muestra contador actual/máximo', () => {
    const photos = [makePhoto({ id: 'p1' }), makePhoto({ id: 'p2' })];
    setupFromChain({ data: { storage_path: null }, error: null });
    render(<ServicePhotoUpload serviceRecordId="sr-1" photos={photos} onPhotosChange={vi.fn()} />);
    expect(screen.getByText('Fotos (2/10)')).toBeInTheDocument();
  });
});

describe('ServicePhotoUpload — Validación de archivos', () => {
  it('acepta image/jpeg', async () => {
    const onPhotosChange = vi.fn();
    const { mockInsert } = setupFromChain();
    setupStorageFromChain();
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={[]} onPhotosChange={onPhotosChange} />);
    fireEvent.change(getFileInput(container), { target: { files: [makeFile('foto.jpg', 1024)] } });
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it('rechaza PNG', async () => {
    const onPhotosChange = vi.fn();
    setupFromChain();
    setupStorageFromChain();
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={[]} onPhotosChange={onPhotosChange} />);
    fireEvent.change(getFileInput(container), { target: { files: [makeFile('foto.png', 1024, 'image/png')] } });
    await waitFor(() => {
      expect(screen.getByText(/rechazado/)).toBeInTheDocument();
    });
    expect(onPhotosChange).not.toHaveBeenCalled();
  });

  it('rechaza archivo mayor a 10 MB', async () => {
    const onPhotosChange = vi.fn();
    setupFromChain();
    setupStorageFromChain();
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={[]} onPhotosChange={onPhotosChange} />);
    fireEvent.change(getFileInput(container), { target: { files: [makeFile('foto.jpg', 11 * 1024 * 1024)] } });
    await waitFor(() => {
      expect(screen.getByText(/superan 10 MB/)).toBeInTheDocument();
    });
    expect(onPhotosChange).not.toHaveBeenCalled();
  });

  it('respeta máximo de 10 fotografías', () => {
    const existingPhotos = Array.from({ length: 10 }, (_, i) => makePhoto({ id: `p${i}` }));
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={existingPhotos} onPhotosChange={vi.fn()} />);
    expect(screen.queryByText('Agregar')).not.toBeInTheDocument();
    expect(getFileInput(container)).toBeInTheDocument();
  });

  it('múltiples archivos se procesan sin superar el límite', async () => {
    const { mockInsert } = setupFromChain();
    setupStorageFromChain();
    const existingPhotos = Array.from({ length: 8 }, (_, i) => makePhoto({ id: `p${i}` }));
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={existingPhotos} onPhotosChange={vi.fn()} />);
    const files = Array.from({ length: 5 }, (_, i) => makeFile(`foto${i}.jpg`, 1024));
    fireEvent.change(getFileInput(container), { target: { files } });
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });
  });
});

describe('ServicePhotoUpload — Permisos por status', () => {
  it('no permite subir cuando status no es draft o rejected', () => {
    render(<ServicePhotoUpload serviceRecordId="sr-1" serviceStatus="approved" photos={[]} onPhotosChange={vi.fn()} />);
    expect(screen.queryByText('Agregar')).not.toBeInTheDocument();
    expect(screen.getByText(/ya no permite agregar fotografías/)).toBeInTheDocument();
  });

  it('draft permite subir', () => {
    render(<ServicePhotoUpload serviceRecordId="sr-1" serviceStatus="draft" photos={[]} onPhotosChange={vi.fn()} />);
    expect(screen.getByText('Agregar')).toBeInTheDocument();
  });

  it('rejected permite subir', () => {
    render(<ServicePhotoUpload serviceRecordId="sr-1" serviceStatus="rejected" photos={[]} onPhotosChange={vi.fn()} />);
    expect(screen.getByText('Agregar')).toBeInTheDocument();
  });
});

describe('ServicePhotoUpload — Upload', () => {
  it('llama upload con serviceRecordId correcto', async () => {
    const { mockUpload } = setupStorageFromChain();
    setupFromChain();
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={[]} onPhotosChange={vi.fn()} />);
    fireEvent.change(getFileInput(container), { target: { files: [makeFile('foto.jpg', 1024)] } });
    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringContaining('sr-1/'),
        expect.any(File),
        { contentType: 'image/jpeg' },
      );
    });
  });

  it('éxito agrega la fotografía', async () => {
    const newPhoto = makePhoto({ id: 'p-new' });
    const { mockInsert } = setupFromChain({ data: newPhoto, error: null });
    setupStorageFromChain();
    const onPhotosChange = vi.fn();
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={[]} onPhotosChange={onPhotosChange} />);
    fireEvent.change(getFileInput(container), { target: { files: [makeFile('foto.jpg', 1024)] } });
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it('éxito llama onPhotosChange', async () => {
    const newPhoto = makePhoto({ id: 'p-new' });
    setupFromChain({ data: newPhoto, error: null });
    setupStorageFromChain();
    const onPhotosChange = vi.fn();
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={[]} onPhotosChange={onPhotosChange} />);
    fireEvent.change(getFileInput(container), { target: { files: [makeFile('foto.jpg', 1024)] } });
    await waitFor(() => {
      expect(onPhotosChange).toHaveBeenCalledWith([newPhoto]);
    });
  });

  it('error de carga muestra mensaje visible', async () => {
    setupStorageFromChain({ message: 'Storage error' });
    setupFromChain();
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={[]} onPhotosChange={vi.fn()} />);
    fireEvent.change(getFileInput(container), { target: { files: [makeFile('foto.jpg', 1024)] } });
    await waitFor(() => {
      expect(screen.getByText(/Storage error/)).toBeInTheDocument();
    });
  });

  it('mientras uploading no permite otra carga', async () => {
    let resolveUpload!: (value: { error: null }) => void;
    mockSupabaseStorageFrom.mockReturnValue({
      upload: vi.fn().mockImplementation(() => new Promise((r) => { resolveUpload = r; })),
      remove: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: '' } }),
    });
    setupFromChain();
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={[]} onPhotosChange={vi.fn()} />);
    fireEvent.change(getFileInput(container), { target: { files: [makeFile('foto.jpg', 1024)] } });
    await waitFor(() => {
      expect(screen.queryByText('Agregar')).not.toBeInTheDocument();
    });
    resolveUpload({ error: null });
  });
});

describe('ServicePhotoUpload — Vista previa', () => {
  it('abre vista previa', async () => {
    const photos = [makePhoto({ id: 'p1' })];
    setupFromChain({ data: { storage_path: null }, error: null });
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={photos} onPhotosChange={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('.aspect-square img')).toBeInTheDocument();
    });
    fireEvent.click(container.querySelector('.aspect-square')!);
    expect(screen.getByAltText('Vista previa')).toBeInTheDocument();
  });

  it('cierra vista previa', async () => {
    const photos = [makePhoto({ id: 'p1' })];
    setupFromChain({ data: { storage_path: null }, error: null });
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={photos} onPhotosChange={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('.aspect-square img')).toBeInTheDocument();
    });
    fireEvent.click(container.querySelector('.aspect-square')!);
    expect(screen.getByAltText('Vista previa')).toBeInTheDocument();
    fireEvent.click(screen.getByAltText('Vista previa').closest('.fixed')!);
    expect(screen.queryByAltText('Vista previa')).not.toBeInTheDocument();
  });
});

describe('ServicePhotoUpload — Eliminación', () => {
  it('confirmación cancelada no elimina', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const photos = [makePhoto({ id: 'p1' })];
    setupFromChain({ data: { storage_path: 'path/photo.jpg' }, error: null });
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={photos} onPhotosChange={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('.group button')).toBeInTheDocument();
    });
    fireEvent.click(container.querySelector('.group button')!);
    expect(window.confirm).toHaveBeenCalled();
  });

  it('confirmación aceptada llama delete', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { mockEqForDelete } = setupFromChain({ data: { storage_path: 'path/photo.jpg' }, error: null });
    const { mockRemove } = setupStorageFromChain();
    const onPhotosChange = vi.fn();
    const photos = [makePhoto({ id: 'p1' })];
    const { container } = render(<ServicePhotoUpload serviceRecordId="sr-1" photos={photos} onPhotosChange={onPhotosChange} />);
    await waitFor(() => {
      expect(container.querySelector('.group button')).toBeInTheDocument();
    });
    fireEvent.click(container.querySelector('.group button')!);
    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith(['path/photo.jpg']);
      expect(mockEqForDelete).toHaveBeenCalledWith('id', 'p1');
    });
    expect(onPhotosChange).toHaveBeenCalledWith([]);
  });
});

describe('ServicePhotoUpload — readOnly', () => {
  it('readOnly oculta controles de edición', () => {
    const photos = [makePhoto({ id: 'p1' })];
    setupFromChain({ data: { storage_path: null }, error: null });
    render(<ServicePhotoUpload serviceRecordId="sr-1" photos={photos} onPhotosChange={vi.fn()} readOnly />);
    expect(screen.queryByText('Agregar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
