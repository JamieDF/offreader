// Type stubs for foliate-js — no official @types package exists
declare module 'foliate-js/view.js' {
  // Side-effectful import that registers the <foliate-view> custom element
}

declare module 'foliate-js/overlayer.js' {
  export class Overlayer {
    constructor(doc: Document);
    readonly element: SVGSVGElement;
    add(range: Range | string, draw: (canvas: HTMLCanvasElement, rect: DOMRect) => void): void;
    remove(range: Range | string): void;
    redraw(): void;
  }
}
