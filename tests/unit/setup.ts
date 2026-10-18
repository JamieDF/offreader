import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// jsdom's crypto lacks subtle — use Node's WebCrypto for hashing in tests
if (typeof crypto === 'undefined' || !crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer === 'undefined') {
  Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof Blob !== 'undefined' && typeof Blob.prototype.text === 'undefined') {
  Blob.prototype.text = function (): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// Stub canvas APIs — jsdom doesn't implement them; parsers handle the failure gracefully
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => null;
  HTMLCanvasElement.prototype.toDataURL = () => '';
}
