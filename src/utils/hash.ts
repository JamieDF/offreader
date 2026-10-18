/**
 * SHA-256 of a Blob's contents, hex-encoded. Loads the whole blob into memory
 * once: acceptable since the reader materializes full files anyway, and it
 * runs once per import/migration rather than per open.
 */
export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
