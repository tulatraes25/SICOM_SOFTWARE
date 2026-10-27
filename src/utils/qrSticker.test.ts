import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QR_STICKER_WIDTH,
  QR_STICKER_HEIGHT,
  QR_STICKER_SYMBOL_SIZE,
  QR_STICKER_SYMBOL_MARGIN,
  downloadQrStickerPng,
  qrStickerFileName,
  renderQrStickerPng,
} from './qrSticker';

function qrSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 50 50');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M0 0h10v10H0z');
  svg.appendChild(path);
  return svg;
}

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(value: string) {
    receivedSvgUrls.push(value);
    Promise.resolve().then(() => this.onload?.());
  }
}

const receivedSvgUrls: string[] = [];
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const drawImage = vi.fn();
const fillRect = vi.fn();
const fillText = vi.fn();
const context = {
  fillStyle: '',
  font: '',
  textAlign: 'left',
  textBaseline: 'alphabetic',
  imageSmoothingEnabled: true,
  fillRect,
  drawImage,
  fillText,
} as unknown as CanvasRenderingContext2D;

const createObjectURL = vi.fn(() => 'blob:sicom-test');
const revokeObjectURL = vi.fn();
const anchorClick = vi.fn();

function restoreMethod(target: object, key: string, original: unknown) {
  if (original === undefined) {
    Reflect.deleteProperty(target, key);
  } else {
    Object.defineProperty(target, key, { configurable: true, writable: true, value: original });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  receivedSvgUrls.length = 0;
  vi.stubGlobal('Image', FakeImage);
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true, writable: true, value: vi.fn(() => context),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true, writable: true,
    value: vi.fn((callback: (blob: Blob | null) => void) => {
      callback(new Blob(['PNG test'], { type: 'image/png' }));
    }),
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true, writable: true, value: createObjectURL,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true, writable: true, value: revokeObjectURL,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(anchorClick);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  restoreMethod(HTMLCanvasElement.prototype, 'getContext', originalGetContext);
  restoreMethod(HTMLCanvasElement.prototype, 'toBlob', originalToBlob);
  restoreMethod(URL, 'createObjectURL', originalCreateObjectURL);
  restoreMethod(URL, 'revokeObjectURL', originalRevokeObjectURL);
});

describe('Etiqueta QR descargable', () => {
  it('sanitiza la barra en códigos reales y no permite rutas en el nombre', () => {
    expect(qrStickerFileName('ASC-22/01')).toBe('SICOM_QR_ASC-22_01.png');
    expect(qrStickerFileName('ASC-54/04')).toBe('SICOM_QR_ASC-54_04.png');
    expect(qrStickerFileName('../../otro')).toBe('SICOM_QR_otro.png');
    expect(qrStickerFileName('')).toBe('SICOM_QR_ascensor.png');
  });

  it('renderiza PNG 1200x1440 con el QR y un margen blanco para poder escanearlo', async () => {
    const blob = await renderQrStickerPng(qrSvg(), 'ASC-22/01');
    expect(blob.type).toBe('image/png');
    const canvas = document.querySelector('canvas');
    expect(canvas).not.toBeInTheDocument(); // no agrega nodos ocultos ni modifica el DOM
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      QR_STICKER_SYMBOL_MARGIN, QR_STICKER_SYMBOL_MARGIN,
      QR_STICKER_SYMBOL_SIZE, QR_STICKER_SYMBOL_SIZE,
    );
    expect(QR_STICKER_WIDTH).toBe(1200);
    expect(QR_STICKER_HEIGHT).toBe(1440);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1200, 1440);
    expect(fillText).toHaveBeenCalledWith('ASC-22/01', 600, 1195, 1100);
    expect(fillText).toHaveBeenCalledWith('SICOM Patagonia SRL', 600, 1348, 1100);
    expect(receivedSvgUrls).toHaveLength(1);
    expect(decodeURIComponent(receivedSvgUrls[0]!)).toContain('viewBox="0 0 50 50"');
  });

  it('descarga archivo PNG a partir del SVG existente sin crear QR ni token nuevos', async () => {
    let capturedName = '';
    let capturedHref = '';
    anchorClick.mockImplementation(function (this: HTMLAnchorElement) {
      capturedName = this.download;
      capturedHref = this.href;
    });
    await downloadQrStickerPng(qrSvg(), 'ASC-22/01');
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(capturedName).toBe('SICOM_QR_ASC-22_01.png');
    expect(capturedHref).toContain('blob:sicom-test');
    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/png' }));
    expect(document.querySelector('a[download^="SICOM_QR_"]')).toBeNull();
  });

  it('rechaza el caso donde el navegador no puede generar la imagen', async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true, writable: true, value: vi.fn(() => null),
    });
    await expect(renderQrStickerPng(qrSvg(), 'ASC-22/01'))
      .rejects.toThrow(/navegador no permite generar/);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('no descarga archivo vacío si canvas falla en toBlob', async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true, writable: true,
      value: vi.fn((callback: (blob: Blob | null) => void) => callback(null)),
    });
    await expect(downloadQrStickerPng(qrSvg(), 'ASC-22/01'))
      .rejects.toThrow(/No se pudo crear el archivo PNG/);
    expect(anchorClick).not.toHaveBeenCalled();
  });
});
