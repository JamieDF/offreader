import { pdfjsLib } from 'foliate-js/pdfjs.js'

export interface PdfMetadata {
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
  pageCount: number;
  readingTime: string;
  format: string;
  coverImage?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractCover = async (pdf: any): Promise<string> => {
  try {
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const canvas = document.createElement('canvas')
    canvas.height = viewport.height
    canvas.width = viewport.width
    await page.render({ canvas, viewport }).promise
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenOutline(items: any[], counter = { n: 0 }): { label: string; href: string; index: number }[] {
  const result: { label: string; href: string; index: number }[] = [];
  for (const item of items) {
    result.push({ label: item.title || `Section ${counter.n + 1}`, href: JSON.stringify(item.dest), index: counter.n++ });
    if (Array.isArray(item.items) && item.items.length > 0) {
      result.push(...flattenOutline(item.items, counter));
    }
  }
  return result;
}

export const extractPdfMetadata = async (file: File): Promise<PdfMetadata> => {
  const arrayBuffer = await file.arrayBuffer()

  const header = new Uint8Array(arrayBuffer, 0, 5)
  if (
    header[0] !== 0x25 || header[1] !== 0x50 ||
    header[2] !== 0x44 || header[3] !== 0x46 || header[4] !== 0x2d
  ) {
    throw new Error('Invalid PDF file')
  }

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const fileName = file.name.replace(/\.[^/.]+$/, '')
  let title = fileName
  let author = 'Unknown Author'
  let description = ''
  let language: string | undefined
  let publisher: string | undefined

  try {
    const { metadata, info } = await pdf.getMetadata() ?? {}
    const pdfInfo = info as Record<string, string> | undefined
    const rawTitle = metadata?.get('dc:title') ?? pdfInfo?.Title ?? fileName
    const rawAuthor = metadata?.get('dc:creator') ?? pdfInfo?.Author ?? 'Unknown Author'
    const rawDescription = metadata?.get('dc:description') ?? pdfInfo?.Subject ?? ''
    // PDF metadata values can be arrays or objects — coerce to string
    title = String(rawTitle)
    author = String(rawAuthor)
    description = String(rawDescription)
    language = metadata?.get('dc:language') != null ? String(metadata.get('dc:language')) : undefined
    publisher = metadata?.get('dc:publisher') != null ? String(metadata.get('dc:publisher')) : undefined
  } catch {
    // Proceed with filename fallback
  }

  const outline = await pdf.getOutline().catch(() => null)
  const chapters = outline ? flattenOutline(outline) : []

  const coverImage = await extractCover(pdf)

  const totalPageCount = pdf.numPages
  const totalChapters = chapters.length

  const readingMins = totalPageCount * 2
  const h = Math.floor(readingMins / 60)
  const m = readingMins % 60
  const readingTime = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`

  await pdf.destroy()

  return {
    title: title || fileName,
    author: author || 'Unknown Author',
    publisher,
    language,
    description: description || 'A PDF document.',
    subjects: [],
    chapters,
    totalChapters,
    pageCount: totalPageCount,
    readingTime,
    format: 'PDF',
    coverImage,
  }
}
