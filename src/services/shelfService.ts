import { Shelf } from "@/types/book";
import { storageService } from "./storage";

const SHELVES_STORAGE_KEY = 'offreader-shelves';
const LAST_USED_SHELF_KEY = 'offreader-last-used-shelf';

class ShelfService {
  private static instance: ShelfService;
  private shelves: Shelf[] = [];
  private lastUsedShelfId: string | null = null;
  private isLoading: boolean = true;
  private listeners: Set<() => void> = new Set();

  static getInstance(): ShelfService {
    if (!ShelfService.instance) {
      ShelfService.instance = new ShelfService();
    }
    return ShelfService.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.isLoading = true;
      this.notifyListeners();

      const storedShelves = await storageService.getItem(SHELVES_STORAGE_KEY);
      this.shelves = storedShelves ? JSON.parse(storedShelves) : [];

      const lastUsed = await storageService.getItem(LAST_USED_SHELF_KEY);
      this.lastUsedShelfId = lastUsed || null;

      this.isLoading = false;
      this.notifyListeners();
    } catch (error) {
      console.error('ShelfService initialization failed:', error);
      this.isLoading = false;
      this.notifyListeners();
    }
  }

  private async persist(): Promise<void> {
    try {
      await storageService.setItem(SHELVES_STORAGE_KEY, JSON.stringify(this.shelves));
    } catch (error) {
      console.error('Failed to persist shelves:', error);
      throw error;
    }
  }

  private async persistLastUsed(): Promise<void> {
    try {
      if (this.lastUsedShelfId) {
        await storageService.setItem(LAST_USED_SHELF_KEY, this.lastUsedShelfId);
      } else {
        await storageService.removeItem(LAST_USED_SHELF_KEY);
      }
    } catch (error) {
      console.error('Failed to persist last used shelf:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  getShelves(): Shelf[] {
    return [...this.shelves].sort((a, b) => a.order - b.order);
  }

  getShelfById(id: string): Shelf | undefined {
    return this.shelves.find(s => s.id === id);
  }

  getDefaultShelf(): Shelf | undefined {
    return this.shelves.find(s => s.isDefault);
  }

  getLastUsedShelfId(): string | null {
    return this.lastUsedShelfId;
  }

  isLoading(): boolean {
    return this.isLoading;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async createShelf(name: string): Promise<Shelf> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Shelf name cannot be empty');
    }

    if (this.shelves.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error('A shelf with this name already exists');
    }

    const maxOrder = this.shelves.reduce((max, s) => Math.max(max, s.order), 0);
    const newShelf: Shelf = {
      id: crypto.randomUUID(),
      name: trimmedName,
      isDefault: false,
      order: maxOrder + 1,
    };

    this.shelves.push(newShelf);
    await this.persist();
    this.notifyListeners();
    return newShelf;
  }

  async updateShelf(id: string, updates: Partial<Pick<Shelf, 'name' | 'isDefault'>>): Promise<void> {
    const shelf = this.shelves.find(s => s.id === id);
    if (!shelf) {
      throw new Error('Shelf not found');
    }

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName) {
        throw new Error('Shelf name cannot be empty');
      }

      const duplicate = this.shelves.find(
        s => s.id !== id && s.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        throw new Error('A shelf with this name already exists');
      }

      shelf.name = trimmedName;
    }

    if (updates.isDefault !== undefined && updates.isDefault) {
      this.shelves.forEach(s => { s.isDefault = false; });
      shelf.isDefault = true;
    }

    await this.persist();
    this.notifyListeners();
  }

  async deleteShelf(id: string): Promise<void> {
    if (this.shelves.length <= 1) {
      throw new Error('Cannot delete the last remaining shelf');
    }

    const index = this.shelves.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error('Shelf not found');
    }

    this.shelves.splice(index, 1);

    if (this.lastUsedShelfId === id) {
      this.lastUsedShelfId = null;
      await this.persistLastUsed();
    }

    await this.persist();
    this.notifyListeners();
  }

  async reorderShelves(orderedIds: string[]): Promise<void> {
    const existingIds = new Set(this.shelves.map(s => s.id));
    if (orderedIds.length !== existingIds.size || !orderedIds.every(id => existingIds.has(id))) {
      throw new Error('Invalid shelf order - all shelves must be included');
    }

    orderedIds.forEach((id, index) => {
      const shelf = this.shelves.find(s => s.id === id);
      if (shelf) {
        shelf.order = index;
      }
    });

    await this.persist();
    this.notifyListeners();
  }

  async setDefaultShelf(id: string): Promise<void> {
    const shelf = this.shelves.find(s => s.id === id);
    if (!shelf) {
      throw new Error('Shelf not found');
    }

    this.shelves.forEach(s => { s.isDefault = false; });
    shelf.isDefault = true;

    await this.persist();
    this.notifyListeners();
  }

  async setLastUsedShelf(id: string | null): Promise<void> {
    this.lastUsedShelfId = id;
    await this.persistLastUsed();
  }
}

export const shelfService = ShelfService.getInstance();