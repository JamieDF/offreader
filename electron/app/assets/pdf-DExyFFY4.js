import{c as w}from"./index-B559p06w.js";const k=`/* Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

.textLayer {
  color-scheme: only light;

  position: absolute;
  text-align: initial;
  inset: 0;
  overflow: clip;
  opacity: 1;
  line-height: 1;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  caret-color: CanvasText;
  z-index: 0;

  &.highlighting {
    touch-action: none;
  }

  :is(span, br) {
    color: transparent;
    position: absolute;
    white-space: pre;
    cursor: text;
    transform-origin: 0% 0%;
  }

  /* We multiply the font size by --min-font-size, and then scale the text
   * elements by 1/--min-font-size. This allows us to effectively ignore the
   * minimum font size enforced by the browser, so that the text layer <span>s
   * can always match the size of the text in the canvas. */
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));

  > :not(.markedContent),
  .markedContent span:not(.markedContent) {
    z-index: 1;

    --font-height: 0; /* set by text_layer.js */
    font-size: calc(var(--text-scale-factor) * var(--font-height));

    --scale-x: 1;
    --rotate: 0deg;
    transform: rotate(var(--rotate)) scaleX(var(--scale-x))
      scale(var(--min-font-size-inv));
  }

  .markedContent {
    display: contents;
  }

  span[role="img"] {
    user-select: none;
    cursor: default;
  }

  .highlight {
    --highlight-bg-color: rgb(180 0 170 / 0.25);
    --highlight-selected-bg-color: rgb(0 100 0 / 0.25);
    --highlight-backdrop-filter: none;
    --highlight-selected-backdrop-filter: none;

    @media screen and (forced-colors: active) {
      --highlight-bg-color: transparent;
      --highlight-selected-bg-color: transparent;
      --highlight-backdrop-filter: var(--hcm-highlight-filter);
      --highlight-selected-backdrop-filter: var(
        --hcm-highlight-selected-filter
      );
    }

    margin: -1px;
    padding: 1px;
    background-color: var(--highlight-bg-color);
    backdrop-filter: var(--highlight-backdrop-filter);
    border-radius: 4px;

    &.appended {
      position: initial;
    }

    &.begin {
      border-radius: 4px 0 0 4px;
    }

    &.end {
      border-radius: 0 4px 4px 0;
    }

    &.middle {
      border-radius: 0;
    }

    &.selected {
      background-color: var(--highlight-selected-bg-color);
      backdrop-filter: var(--highlight-selected-backdrop-filter);
    }
  }

  ::selection {
    /* stylelint-disable declaration-block-no-duplicate-properties */
    /*#if !MOZCENTRAL*/
    background: rgba(0 0 255 / 0.25);
    /*#endif*/
    /* stylelint-enable declaration-block-no-duplicate-properties */
    background: color-mix(in srgb, AccentColor, transparent 75%);
  }

  /* Avoids https://github.com/mozilla/pdf.js/issues/13840 in Chrome */
  /*#if !MOZCENTRAL*/
  br::selection {
    background: transparent;
  }
  /*#endif*/

  .endOfContent {
    display: block;
    position: absolute;
    inset: 100% 0 0;
    z-index: 0;
    cursor: default;
    user-select: none;
  }

  &.selecting .endOfContent {
    top: 0;
  }
}
`,y=`/* Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

.annotationLayer {
  color-scheme: only light;

  --annotation-unfocused-field-background: url("data:image/svg+xml;charset=UTF-8,<svg width='1px' height='1px' xmlns='http://www.w3.org/2000/svg'><rect width='100%' height='100%' style='fill:rgba(0, 54, 255, 0.13);'/></svg>");
  --input-focus-border-color: Highlight;
  --input-focus-outline: 1px solid Canvas;
  --input-unfocused-border-color: transparent;
  --input-disabled-border-color: transparent;
  --input-hover-border-color: black;
  --link-outline: none;

  @media screen and (forced-colors: active) {
    --input-focus-border-color: CanvasText;
    --input-unfocused-border-color: ActiveText;
    --input-disabled-border-color: GrayText;
    --input-hover-border-color: Highlight;
    --link-outline: 1.5px solid LinkText;

    .textWidgetAnnotation :is(input, textarea):required,
    .choiceWidgetAnnotation select:required,
    .buttonWidgetAnnotation:is(.checkBox, .radioButton) input:required {
      outline: 1.5px solid selectedItem;
    }

    .linkAnnotation {
      outline: var(--link-outline);

      &:hover {
        backdrop-filter: var(--hcm-highlight-filter);
      }

      & > a:hover {
        opacity: 0 !important;
        background: none !important;
        box-shadow: none;
      }
    }

    .popupAnnotation .popup {
      outline: calc(1.5px * var(--total-scale-factor)) solid CanvasText !important;
      background-color: ButtonFace !important;
      color: ButtonText !important;
    }

    .highlightArea:hover::after {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      backdrop-filter: var(--hcm-highlight-filter);
      content: "";
      pointer-events: none;
    }

    .popupAnnotation.focused .popup {
      outline: calc(3px * var(--total-scale-factor)) solid Highlight !important;
    }
  }

  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  transform-origin: 0 0;

  &[data-main-rotation="90"] .norotate {
    transform: rotate(270deg) translateX(-100%);
  }
  &[data-main-rotation="180"] .norotate {
    transform: rotate(180deg) translate(-100%, -100%);
  }
  &[data-main-rotation="270"] .norotate {
    transform: rotate(90deg) translateY(-100%);
  }

  &.disabled {
    section,
    .popup {
      pointer-events: none;
    }
  }

  .annotationContent {
    position: absolute;
    width: 100%;
    height: 100%;
    pointer-events: none;

    &.freetext {
      background: transparent;
      border: none;
      inset: 0;
      overflow: visible;
      white-space: nowrap;
      font: 10px sans-serif;
      line-height: 1.35;
    }
  }

  section {
    position: absolute;
    text-align: initial;
    pointer-events: auto;
    box-sizing: border-box;
    transform-origin: 0 0;
    user-select: none;

    &:has(div.annotationContent) {
      canvas.annotationContent {
        display: none;
      }
    }

    .overlaidText {
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      display: inline-block;
      overflow: hidden;
    }
  }

  .textLayer.selecting ~ & section {
    pointer-events: none;
  }

  :is(.linkAnnotation, .buttonWidgetAnnotation.pushButton) > a {
    position: absolute;
    font-size: 1em;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  :is(.linkAnnotation, .buttonWidgetAnnotation.pushButton):not(.hasBorder)
    > a:hover {
    opacity: 0.2;
    background-color: rgb(255 255 0);
  }

  .linkAnnotation.hasBorder:hover {
    background-color: rgb(255 255 0 / 0.2);
  }

  .hasBorder {
    background-size: 100% 100%;
  }

  .textAnnotation img {
    position: absolute;
    cursor: pointer;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
  }

  .textWidgetAnnotation :is(input, textarea),
  .choiceWidgetAnnotation select,
  .buttonWidgetAnnotation:is(.checkBox, .radioButton) input {
    background-image: var(--annotation-unfocused-field-background);
    border: 2px solid var(--input-unfocused-border-color);
    box-sizing: border-box;
    font: calc(9px * var(--total-scale-factor)) sans-serif;
    height: 100%;
    margin: 0;
    vertical-align: top;
    width: 100%;
  }

  .textWidgetAnnotation :is(input, textarea):required,
  .choiceWidgetAnnotation select:required,
  .buttonWidgetAnnotation:is(.checkBox, .radioButton) input:required {
    outline: 1.5px solid red;
  }

  .choiceWidgetAnnotation select option {
    padding: 0;
  }

  .buttonWidgetAnnotation.radioButton input {
    border-radius: 50%;
  }

  .textWidgetAnnotation textarea {
    resize: none;
  }

  .textWidgetAnnotation :is(input, textarea)[disabled],
  .choiceWidgetAnnotation select[disabled],
  .buttonWidgetAnnotation:is(.checkBox, .radioButton) input[disabled] {
    background: none;
    border: 2px solid var(--input-disabled-border-color);
    cursor: not-allowed;
  }

  .textWidgetAnnotation :is(input, textarea):hover,
  .choiceWidgetAnnotation select:hover,
  .buttonWidgetAnnotation:is(.checkBox, .radioButton) input:hover {
    border: 2px solid var(--input-hover-border-color);
  }
  .textWidgetAnnotation :is(input, textarea):hover,
  .choiceWidgetAnnotation select:hover,
  .buttonWidgetAnnotation.checkBox input:hover {
    border-radius: 2px;
  }

  .textWidgetAnnotation :is(input, textarea):focus,
  .choiceWidgetAnnotation select:focus {
    background: none;
    border: 2px solid var(--input-focus-border-color);
    border-radius: 2px;
    outline: var(--input-focus-outline);
  }

  .buttonWidgetAnnotation:is(.checkBox, .radioButton) :focus {
    background-image: none;
    background-color: transparent;
  }

  .buttonWidgetAnnotation.checkBox :focus {
    border: 2px solid var(--input-focus-border-color);
    border-radius: 2px;
    outline: var(--input-focus-outline);
  }

  .buttonWidgetAnnotation.radioButton :focus {
    border: 2px solid var(--input-focus-border-color);
    outline: var(--input-focus-outline);
  }

  .buttonWidgetAnnotation.checkBox input:checked::before,
  .buttonWidgetAnnotation.checkBox input:checked::after,
  .buttonWidgetAnnotation.radioButton input:checked::before {
    background-color: CanvasText;
    content: "";
    display: block;
    position: absolute;
  }

  .buttonWidgetAnnotation.checkBox input:checked::before,
  .buttonWidgetAnnotation.checkBox input:checked::after {
    height: 80%;
    left: 45%;
    width: 1px;
  }

  .buttonWidgetAnnotation.checkBox input:checked::before {
    transform: rotate(45deg);
  }

  .buttonWidgetAnnotation.checkBox input:checked::after {
    transform: rotate(-45deg);
  }

  .buttonWidgetAnnotation.radioButton input:checked::before {
    border-radius: 50%;
    height: 50%;
    left: 25%;
    top: 25%;
    width: 50%;
  }

  .textWidgetAnnotation input.comb {
    font-family: monospace;
    padding-left: 2px;
    padding-right: 0;
  }

  .textWidgetAnnotation input.comb:focus {
    /*
     * Letter spacing is placed on the right side of each character. Hence, the
     * letter spacing of the last character may be placed outside the visible
     * area, causing horizontal scrolling. We avoid this by extending the width
     * when the element has focus and revert this when it loses focus.
     */
    width: 103%;
  }

  .buttonWidgetAnnotation:is(.checkBox, .radioButton) input {
    appearance: none;
  }

  .fileAttachmentAnnotation .popupTriggerArea {
    height: 100%;
    width: 100%;
  }

  .popupAnnotation {
    position: absolute;
    font-size: calc(9px * var(--total-scale-factor));
    pointer-events: none;
    width: max-content;
    max-width: 45%;
    height: auto;
  }

  .popup {
    background-color: rgb(255 255 153);
    color: black;
    box-shadow: 0 calc(2px * var(--total-scale-factor))
      calc(5px * var(--total-scale-factor)) rgb(136 136 136);
    border-radius: calc(2px * var(--total-scale-factor));
    outline: 1.5px solid rgb(255 255 74);
    padding: calc(6px * var(--total-scale-factor));
    cursor: pointer;
    font: message-box;
    white-space: normal;
    word-wrap: break-word;
    pointer-events: auto;
    user-select: text;
  }

  .popupAnnotation.focused .popup {
    outline-width: 3px;
  }

  .popup * {
    font-size: calc(9px * var(--total-scale-factor));
  }

  .popup > .header {
    display: inline-block;
  }

  .popup > .header > .title {
    display: inline;
    font-weight: bold;
  }

  .popup > .header .popupDate {
    display: inline-block;
    margin-left: calc(5px * var(--total-scale-factor));
    width: fit-content;
  }

  .popupContent {
    border-top: 1px solid rgb(51 51 51);
    margin-top: calc(2px * var(--total-scale-factor));
    padding-top: calc(2px * var(--total-scale-factor));
  }

  .richText > * {
    white-space: pre-wrap;
    font-size: calc(9px * var(--total-scale-factor));
  }

  .popupTriggerArea {
    cursor: pointer;

    &:hover {
      backdrop-filter: var(--hcm-highlight-filter);
    }
  }

  section svg {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
  }

  .annotationTextContent {
    position: absolute;
    width: 100%;
    height: 100%;
    opacity: 0;
    color: transparent;
    user-select: none;
    pointer-events: none;

    span {
      width: 100%;
      display: inline-block;
    }
  }

  svg.quadrilateralsContainer {
    contain: strict;
    width: 0;
    height: 0;
    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
  }
}
`,g=globalThis.pdfjsLib;g.GlobalWorkerOptions.workerSrc=w;const A=async(o,i,r,e=0,n=null)=>{const s=Math.min(devicePixelRatio,2),c=r*s;i.documentElement.style.transform=`scale(${1/s})`,i.documentElement.style.transformOrigin="top left",i.documentElement.style.setProperty("--scale-factor",c);const l=o.getViewport({scale:c,rotation:e}),d=document.createElement("canvas");d.height=l.height,d.width=l.width;const a=d.getContext("2d");await o.render({canvasContext:a,viewport:l}).promise,i.querySelector("#canvas").replaceChildren(i.adoptNode(d)),n==null||n();const t=i.querySelector(".textLayer");await new g.TextLayer({textContentSource:await o.streamTextContent(),container:t,viewport:l}).render();for(const u of document.querySelectorAll(".hiddenCanvasElement"))Object.assign(u.style,{position:"absolute",top:"0",left:"0",width:"0",height:"0",display:"none"});const h=document.createElement("div");h.className="endOfContent",t.append(h),t.onpointerdown=()=>t.classList.add("selecting"),t.onpointerup=()=>t.classList.remove("selecting");const x=i.querySelector(".annotationLayer"),v={goToDestination:()=>{},getDestinationHash:u=>JSON.stringify(u),addLinkAttributes:(u,m)=>u.href=m,getAnchorUrl:u=>u};await new g.AnnotationLayer({page:o,viewport:l,div:x,linkService:v}).render({annotations:await o.getAnnotations()})},b=async(o,i,r=0)=>{const e=o.getViewport({scale:1,rotation:r});if(i){const c=document.createElement("canvas");c.height=e.height,c.width=e.width;const l=c.getContext("2d");return await o.render({canvasContext:l,viewport:e}).promise,new Promise(d=>c.toBlob(d))}return{src:URL.createObjectURL(new Blob([`
        <!DOCTYPE html>
        <html lang="en">
        <meta charset="utf-8">
        <meta name="viewport" content="width=${e.width}, height=${e.height}">
        <style>
        html, body {
            margin: 0;
            padding: 0;
        }
        /*
        https://github.com/mozilla/pdf.js/commit/bd05b255fabfc313b194bfe9a17ccded4d90fb5a
        */
        :root {
          --user-unit: 1;
          --total-scale-factor: calc(var(--scale-factor) * var(--user-unit));
          --scale-round-x: 1px;
          --scale-round-y: 1px;
        }
        ${k}
        ${y}
        </style>
        <div id="canvas"></div>
        <div class="textLayer"></div>
        <div class="annotationLayer"></div>
    `],{type:"text/html"})),onZoom:({doc:c,scale:l,onCanvasReady:d})=>A(o,c,l,r,d)}},f=o=>{var i;return{label:o.title,href:JSON.stringify(o.dest),subitems:(i=o.items)!=null&&i.length?o.items.map(f):null}},L=async o=>{const i=new g.PDFDataRangeTransport(o.size,[]);i.requestDataRange=(a,t)=>{o.slice(a,t).arrayBuffer().then(p=>{i.onDataRange(a,p)})};const r=await g.getDocument({range:i,isEvalSupported:!1}).promise,e={rendition:{layout:"pre-paginated",spread:"none"},pdfDoc:r},{metadata:n,info:s}=await r.getMetadata()??{};e.metadata={title:(n==null?void 0:n.get("dc:title"))??(s==null?void 0:s.Title),author:(n==null?void 0:n.get("dc:creator"))??(s==null?void 0:s.Author),contributor:n==null?void 0:n.get("dc:contributor"),description:(n==null?void 0:n.get("dc:description"))??(s==null?void 0:s.Subject),language:n==null?void 0:n.get("dc:language"),publisher:n==null?void 0:n.get("dc:publisher"),subject:n==null?void 0:n.get("dc:subject"),identifier:n==null?void 0:n.get("dc:identifier"),source:n==null?void 0:n.get("dc:source"),rights:n==null?void 0:n.get("dc:rights")};const c=await r.getOutline();e.toc=c==null?void 0:c.map(f);let l=0;const d=new Map;return e.sections=Array.from({length:r.numPages}).map((a,t)=>({id:t,load:async()=>{const p=d.get(t);if(p)return p;const h=await b(await r.getPage(t+1),!1,l);return d.set(t,h),h},size:1e3})),e.setRotation=a=>{l=a,d.clear()},e.isExternal=a=>/^\w+:/i.test(a),e.resolveHref=async a=>{const t=JSON.parse(a),p=typeof t=="string"?await r.getDestination(t):t;return{index:await r.getPageIndex(p[0])}},e.splitTOCHref=async a=>{const t=JSON.parse(a),p=typeof t=="string"?await r.getDestination(t):t;return[await r.getPageIndex(p[0]),null]},e.getTOCFragment=a=>a.documentElement,e.getCover=async()=>b(await r.getPage(1),!0),e.destroy=()=>r.destroy(),e};export{L as makePDF};
