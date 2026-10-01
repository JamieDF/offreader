import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * JS surface of the Android SAF plugin (OffreaderFilesPlugin.java). A linked
 * "folder" on Android is a persisted document-tree URI (content://…), not a
 * filesystem path — scoped storage leaves no other way to enumerate user
 * folders. Only callable on Android; the plugin is registered in
 * MainActivity.
 */
export interface SafEntry {
  uri: string;
  name: string;
  size: number;
  mtimeMs: number;
}

interface OffreaderFilesPluginType {
  /** SAF document-tree picker; resolves to a persisted tree URI. */
  pickDirectory(): Promise<{ treeUri: string }>;
  /** Single-document picker (relinking); resolves to a document URI. */
  pickDocument(): Promise<{ uri: string }>;
  /** Recursive listing of every file under a tree URI. */
  listFiles(options: { treeUri: string }): Promise<{ files: SafEntry[] }>;
  fileExists(options: { uri: string }): Promise<{ exists: boolean }>;
  statFile(options: { uri: string }): Promise<{ name: string; size: number; mtimeMs: number } | null>;
  /** Copies document bytes into app cache (read-through); resolves to the
   *  cache path suitable for convertFileSrc. */
  resolveToCache(options: { uri: string }): Promise<{ path: string }>;
}

// Lazy — registering eagerly at module load would run native plumbing on web
// too, and test mocks of @capacitor/core don't carry registerPlugin.
let plugin: OffreaderFilesPluginType | null = null;
function getPlugin(): OffreaderFilesPluginType {
  return (plugin ??= registerPlugin<OffreaderFilesPluginType>('OffreaderFiles'));
}

export function isAndroidSafAvailable(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export const safFiles: OffreaderFilesPluginType = {
  pickDirectory: () => getPlugin().pickDirectory(),
  pickDocument: () => getPlugin().pickDocument(),
  listFiles: (options) => getPlugin().listFiles(options),
  fileExists: (options) => getPlugin().fileExists(options),
  statFile: (options) => getPlugin().statFile(options),
  resolveToCache: (options) => getPlugin().resolveToCache(options),
};
