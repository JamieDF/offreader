/**
 * FictionBook 2 metadata parser.
 * Extracts metadata and an embedded cover from the XML document.
 */

import { calculateReadingMetrics } from '@/utils/readingMetrics';

export interface Fb2Metadata {
  title: string;
  author: string;
  publisher?: string;
  pubDate?: string;
  language?: string;
  identifier?: string;
  description?: string;
  subjects?: string[];
  rights?: string;
  chapters: { label: string; href: string; index: number }[];
  totalChapters: number;
  readingTime: string;
  pageCount: number;
  format: 'FB2';
  coverImage?: string;
}

const text = (element: Element | null): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() || '';

const first = (root: Document | Element, localName: string): Element | null =>
  root.getElementsByTagNameNS('*', localName)[0]
  || root.getElementsByTagName(localName)[0]
  || null;

const embeddedImage = (document: Document): string => {
  const image = first(document, 'image');
  const href = image?.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
    || image?.getAttribute('l:href')
    || image?.getAttribute('href');
  if (!href?.startsWith('#')) return '';

  const binary = document.getElementById(href.slice(1));
  const content = binary?.textContent?.replace(/\s+/g, '');
  const contentType = binary?.getAttribute('content-type');
  if (!content || !contentType) return '';
  return `data:${contentType};base64,${content}`;
};

export const extractFb2Metadata = async (file: File): Promise<Fb2Metadata> => {
  const source = new TextDecoder().decode(await file.arrayBuffer());
  const document = new DOMParser().parseFromString(source, 'application/xml');
  const root = document.documentElement;

  if (!root || root.localName !== 'FictionBook' || document.querySelector('parsererror')) {
    throw new Error('Invalid FB2 file');
  }

  const description = first(document, 'description');
  const titleInfo = description ? first(description, 'title-info') : null;
  const bookTitle = text(titleInfo ? first(titleInfo, 'book-title') : null);
  const authorElement = titleInfo ? first(titleInfo, 'author') : null;
  const author = authorElement
    ? [text(first(authorElement, 'first-name')), text(first(authorElement, 'middle-name')), text(first(authorElement, 'last-name'))].filter(Boolean).join(' ')
    : '';
  const annotation = text(titleInfo ? first(titleInfo, 'annotation') : null);
  const genre = text(titleInfo ? first(titleInfo, 'genre') : null);
  const publishInfo = first(document, 'publish-info');
  const publisher = text(publishInfo ? first(publishInfo, 'publisher') : null);
  const year = text(publishInfo ? first(publishInfo, 'year') : null);
  const lang = text(titleInfo ? first(titleInfo, 'lang') : null);
  const documentInfo = description ? first(description, 'document-info') : null;
  const documentId = text(documentInfo ? first(documentInfo, 'id') : null);
  const sections = Array.from(document.getElementsByTagNameNS('*', 'section'));
  const fileName = file.name.replace(/\.[^/.]+$/, '');
  const title = bookTitle || fileName;
  const bodyText = text(root);
  const { readingTime, pageCount } = calculateReadingMetrics(bodyText.length * 2);

  return {
    title,
    author: author || 'Unknown Author',
    publisher: publisher || undefined,
    pubDate: year || undefined,
    language: lang || undefined,
    identifier: documentId || undefined,
    description: annotation || `An FB2 book by ${author || 'Unknown Author'}.`,
    subjects: genre ? [genre] : [],
    chapters: sections.map((section, index) => ({
      label: text(first(section, 'title')) || `Section ${index + 1}`,
      href: section.id ? `#${section.id}` : `section-${index}`,
      index,
    })),
    totalChapters: sections.length,
    readingTime,
    pageCount,
    format: 'FB2',
    coverImage: embeddedImage(document),
  };
};
