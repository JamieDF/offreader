/**
 * Estimates reading time and page count from a file's byte size.
 * Assumes ~6 bytes/word, 275 words/page, 250 wpm reading speed.
 */
export function calculateReadingMetrics(fileSize: number): { readingTime: string; pageCount: number } {
  const estimatedWords = Math.floor(fileSize / 6);
  const estimatedPages = Math.floor(estimatedWords / 275);
  const readingMinutes = Math.floor(estimatedWords / 250);

  const hours = Math.floor(readingMinutes / 60);
  const minutes = readingMinutes % 60;

  let readingTime = '';
  if (hours > 0) {
    readingTime = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    readingTime = `${minutes}m`;
  }

  return {
    readingTime,
    pageCount: Math.max(1, estimatedPages),
  };
}
