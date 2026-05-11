// Type stubs for foliate-js — no official @types package exists
// Note: foliate-view custom element is registered via src/lib/foliate-view.js (local copy),
// not from the npm package directly.

declare module 'foliate-js/overlayer.js' {
  export class Overlayer {
    constructor(doc: Document);
    readonly element: SVGSVGElement;
    add(range: Range | string, draw: (canvas: HTMLCanvasElement, rect: DOMRect) => void): void;
    remove(range: Range | string): void;
    redraw(): void;
  }
}
