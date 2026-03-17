/**
 * Convert a string to title case
 * Capitalizes the first letter of each word, except for common stop words
 * Always capitalizes single letters (A, I, etc.) and the first word
 * 
 * @param str - The string to convert
 * @returns Title case string
 * 
 * @example
 * titleCase("the great gatsby") // "The Great Gatsby"
 * titleCase("a tale of two cities") // "A Tale of Two Cities"
 * titleCase("harry potter and the philosopher's stone") // "Harry Potter and the Philosopher's Stone"
 */
export function titleCase(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }

  // Stop words that should remain lowercase (except at start)
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by',
    'for', 'from', 'has', 'he', 'in', 'is', 'it', 'its',
    'of', 'on', 'or', 'the', 'to', 'was', 'will', 'with'
  ]);

  return str
    .split(/\s+/)
    .map((word, index) => {
      // Always capitalize the first word
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }

      // Single letters should always be capitalized (A, I, etc.)
      if (word.length === 1) {
        return word.toUpperCase();
      }

      // Check if word is a stop word
      const lowerWord = word.toLowerCase();
      if (stopWords.has(lowerWord)) {
        return lowerWord;
      }

      // Capitalize first letter of other words
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
