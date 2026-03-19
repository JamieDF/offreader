import { FontFamily } from '@/hooks/useReaderSettings';

export const FONT_FAMILY_MAP: Record<FontFamily, string> = {
  'Georgia': 'Georgia, "Times New Roman", serif',
  'Playfair Display': '"Playfair Display", "Crimson Text", Georgia, serif',
  'JetBrains Mono': '"JetBrains Mono", "Courier New", monospace',
  'Fira Code': '"Syne Mono", "Space Mono", "Courier New", monospace',
  'Uncial Antiqua': '"Uncial Antiqua", "Cinzel", "Merriweather", serif',
  'Special Elite': '"Special Elite", "Courier Prime", "Courier New", monospace',
  'Lato': '"Lato", "Helvetica Neue", Arial, sans-serif',
  'Montserrat': '"Montserrat", "Helvetica Neue", Arial, sans-serif',
  'Source Sans Pro': '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
};

interface StyleSettings {
  fontSize: number;
  fontFamily: FontFamily;
  lineHeight: number;
  marginWidth: number;
  paragraphSpacing: number;
}

export function buildReaderStylesheet(settings: StyleSettings): string {
  const fontFamily = FONT_FAMILY_MAP[settings.fontFamily] ?? FONT_FAMILY_MAP['Georgia'];
  const fontSize = `${settings.fontSize}%`;
  const lineHeight = settings.lineHeight.toString();
  const marginWidth = `${settings.marginWidth}%`;
  const paragraphSpacing = `${settings.paragraphSpacing}em`;

  return `
    @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Uncial+Antiqua&family=Cinzel:wght@400;600&family=Special+Elite&family=Courier+Prime:wght@400;700&family=Space+Mono:wght@400;700&family=Merriweather:wght@400;700&family=Playfair+Display:wght@400;700&family=Crimson+Text:wght@400;600&family=JetBrains+Mono:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap');

    .force-georgia    { font-family: "Georgia", serif !important; }
    .force-playfair   { font-family: "Playfair Display", serif !important; }
    .force-jetbrains  { font-family: "JetBrains Mono", monospace !important; }
    .force-fira       { font-family: "Syne Mono", monospace !important; }
    .force-uncial     { font-family: "Uncial Antiqua", serif !important; }
    .force-special    { font-family: "Special Elite", monospace !important; }
    .force-lato       { font-family: "Lato", sans-serif !important; }
    .force-montserrat { font-family: "Montserrat", sans-serif !important; }
    .force-source     { font-family: "Source Sans Pro", sans-serif !important; }

    body {
      font-size: ${fontSize} !important;
      line-height: ${lineHeight} !important;
      font-family: ${fontFamily} !important;
      padding-left: ${marginWidth} !important;
      padding-right: ${marginWidth} !important;
    }

    body, p, div, span, h1, h2, h3, h4, h5, h6 {
      font-family: ${fontFamily} !important;
    }

    p {
      margin-bottom: ${paragraphSpacing} !important;
    }
  `;
}
