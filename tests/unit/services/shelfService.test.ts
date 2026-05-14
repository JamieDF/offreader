import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Shelf } from '@/types/book';

// Mock storage service
const mockGetItem = vi.fn();
const mockSetItem = vi.fn();
const mockRemoveItem = vi.fn();

vi.mock('@/services/storage', () => ({
  storageService: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
    removeItem: (...args: unknown[]) => mockRemoveItem(...args),
  },
}));

// Import after mock
import { shelfService } from '@/services/shelfService';

describe('ShelfService', () => {
  // Helper to create a fresh service instance by resetting singleton
  const resetService = async () => {
    // Reset the singleton by accessing the private instance and re-initializing
    // We do this by calling initialize again which resets isLoading
    await shelfService.initialize();
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
    await resetService();
  });

  // Helper to create multiple shelves for delete tests
  const createMultipleShelves = async (count: number) => {
    for (let i = 0; i < count; i++) {
      await shelfService.createShelf(`Shelf ${i + 1}`);
    }
  };

  describe('initialization', () => {
    it('should load shelves from storage on init', async () => {
      const storedShelves: Shelf[] = [
        { id: 'shelf-1', name: 'Reading', isDefault: false, order: 0 },
        { id: 'shelf-2', name: 'Favorites', isDefault: true, order: 1 },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(storedShelves));

      await shelfService.initialize();

      const shelves = shelfService.getShelves();
      expect(shelves).toHaveLength(2);
      expect(shelves[0].name).toBe('Reading');
      expect(shelves[1].name).toBe('Favorites');
    });

    it('should load lastUsedShelfId from storage', async () => {
      mockGetItem.mockImplementation((key: string) => {
        if (key === 'offreader-last-used-shelf') return Promise.resolve('shelf-123');
        return Promise.resolve(null);
      });

      await shelfService.initialize();

      expect(shelfService.getLastUsedShelfId()).toBe('shelf-123');
    });

    it('should handle missing storage gracefully', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      await shelfService.initialize();

      expect(shelfService.getShelves()).toEqual([]);
    });
  });

  describe('createShelf', () => {
    it('should create a new shelf with auto-generated id', async () => {
      const shelf = await shelfService.createShelf('My Shelf');

      expect(shelf.id).toBeDefined();
      expect(shelf.name).toBe('My Shelf');
      expect(shelf.isDefault).toBe(false);
      expect(shelf.order).toBe(1);
    });

    it('should trim whitespace from shelf name', async () => {
      const shelf = await shelfService.createShelf('  Trimmed Name  ');

      expect(shelf.name).toBe('Trimmed Name');
    });

    it('should throw error for empty shelf name', async () => {
      await expect(shelfService.createShelf('')).rejects.toThrow('Shelf name cannot be empty');
      await expect(shelfService.createShelf('   ')).rejects.toThrow('Shelf name cannot be empty');
    });

    it('should throw error for duplicate shelf name (case insensitive)', async () => {
      await shelfService.createShelf('My Shelf');
      await expect(shelfService.createShelf('my shelf')).rejects.toThrow('A shelf with this name already exists');
      await expect(shelfService.createShelf('My Shelf')).rejects.toThrow('A shelf with this name already exists');
    });

    it('should persist to storage', async () => {
      await shelfService.createShelf('Test Shelf');

      expect(mockSetItem).toHaveBeenCalledWith(
        'offreader-shelves',
        expect.stringContaining('Test Shelf')
      );
    });

    it('should notify listeners after creation', async () => {
      const listener = vi.fn();
      const unsub = shelfService.subscribe(listener);

      await shelfService.createShelf('New Shelf');
      expect(listener).toHaveBeenCalled();

      unsub();
    });

    it('should set order based on existing max order', async () => {
      await shelfService.createShelf('First');
      const second = await shelfService.createShelf('Second');

      expect(second.order).toBe(2);
    });
  });

  describe('getShelves', () => {
    it('should return shelves sorted by order', async () => {
      // Create shelves with explicit order by manipulating the order property
      const shelf1 = await shelfService.createShelf('Shelf A');
      const shelf2 = await shelfService.createShelf('Shelf B');
      const shelf3 = await shelfService.createShelf('Shelf C');

      // Manually set order for test
      await shelfService.reorderShelves([shelf3.id, shelf1.id, shelf2.id]);

      const shelves = shelfService.getShelves();

      expect(shelves[0].id).toBe(shelf3.id);
      expect(shelves[1].id).toBe(shelf1.id);
      expect(shelves[2].id).toBe(shelf2.id);
    });

    it('should return empty array when no shelves exist', () => {
      const shelves = shelfService.getShelves();

      expect(shelves).toEqual([]);
    });
  });

  describe('getShelfById', () => {
    it('should return shelf by id', async () => {
      const created = await shelfService.createShelf('Find Me');
      const found = shelfService.getShelfById(created.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('Find Me');
    });

    it('should return undefined for non-existent id', () => {
      const found = shelfService.getShelfById('non-existent');

      expect(found).toBeUndefined();
    });
  });

  describe('updateShelf', () => {
    it('should update shelf name', async () => {
      const shelf = await shelfService.createShelf('Original');
      await shelfService.updateShelf(shelf.id, { name: 'Updated' });

      expect(shelfService.getShelfById(shelf.id)!.name).toBe('Updated');
    });

    it('should throw error when updating to empty name', async () => {
      const shelf = await shelfService.createShelf('Test');
      await expect(shelfService.updateShelf(shelf.id, { name: '' })).rejects.toThrow('Shelf name cannot be empty');
    });

    it('should throw error for duplicate name on update', async () => {
      await shelfService.createShelf('Shelf A');
      const shelfB = await shelfService.createShelf('Shelf B');

      await expect(shelfService.updateShelf(shelfB.id, { name: 'Shelf A' })).rejects.toThrow('A shelf with this name already exists');
    });

    it('should set isDefault and unset others', async () => {
      const shelf1 = await shelfService.createShelf('Shelf 1');
      const shelf2 = await shelfService.createShelf('Shelf 2');

      await shelfService.updateShelf(shelf2.id, { isDefault: true });

      expect(shelfService.getShelfById(shelf1.id)!.isDefault).toBe(false);
      expect(shelfService.getShelfById(shelf2.id)!.isDefault).toBe(true);
    });

    it('should throw error when shelf not found', async () => {
      await expect(shelfService.updateShelf('non-existent', { name: 'New Name' })).rejects.toThrow('Shelf not found');
    });

    it('should persist to storage after update', async () => {
      const shelf = await shelfService.createShelf('Test');
      mockSetItem.mockClear();

      await shelfService.updateShelf(shelf.id, { name: 'Updated' });

      expect(mockSetItem).toHaveBeenCalled();
    });
  });

  describe('deleteShelf', () => {
    it('should delete shelf by id', async () => {
      await createMultipleShelves(3);
      const shelves = shelfService.getShelves();
      const toDelete = shelves[0];

      await shelfService.deleteShelf(toDelete.id);

      expect(shelfService.getShelfById(toDelete.id)).toBeUndefined();
    });

    it('should throw error when deleting last remaining shelf', async () => {
      // Service starts fresh in beforeEach with empty shelves
      await shelfService.createShelf('Only One');

      await expect(shelfService.deleteShelf(shelfService.getShelves()[0].id)).rejects.toThrow('Cannot delete the last remaining shelf');
    });

    it('should throw error when shelf not found', async () => {
      await createMultipleShelves(3);

      await expect(shelfService.deleteShelf('non-existent')).rejects.toThrow('Shelf not found');
    });

    it('should notify listeners after deletion', async () => {
      await createMultipleShelves(3);
      const shelves = shelfService.getShelves();
      const toDelete = shelves[0];
      const listener = vi.fn();
      shelfService.subscribe(listener);

      await shelfService.deleteShelf(toDelete.id);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('reorderShelves', () => {
    it('should reorder shelves based on provided ids', async () => {
      const shelf1 = await shelfService.createShelf('First');
      const shelf2 = await shelfService.createShelf('Second');
      const shelf3 = await shelfService.createShelf('Third');

      await shelfService.reorderShelves([shelf3.id, shelf1.id, shelf2.id]);

      const shelves = shelfService.getShelves();
      expect(shelves[0].id).toBe(shelf3.id);
      expect(shelves[1].id).toBe(shelf1.id);
      expect(shelves[2].id).toBe(shelf2.id);
    });

    it('should throw error for invalid shelf order', async () => {
      await shelfService.createShelf('Shelf 1');
      await shelfService.createShelf('Shelf 2');

      await expect(shelfService.reorderShelves(['wrong-id'])).rejects.toThrow('Invalid shelf order');
    });
  });

  describe('setDefaultShelf', () => {
    it('should set a shelf as default', async () => {
      const shelf = await shelfService.createShelf('Make Default');
      await shelfService.setDefaultShelf(shelf.id);

      expect(shelfService.getDefaultShelf()?.id).toBe(shelf.id);
    });

    it('should unset default when setting new default', async () => {
      const shelf1 = await shelfService.createShelf('Shelf 1');
      const shelf2 = await shelfService.createShelf('Shelf 2');

      await shelfService.setDefaultShelf(shelf1.id);
      await shelfService.setDefaultShelf(shelf2.id);

      expect(shelfService.getDefaultShelf()?.id).toBe(shelf2.id);
    });
  });

  describe('setLastUsedShelf', () => {
    it('should set last used shelf id and persist', async () => {
      const shelf = await shelfService.createShelf('Last Used');
      await shelfService.setLastUsedShelf(shelf.id);

      expect(shelfService.getLastUsedShelfId()).toBe(shelf.id);
      expect(mockSetItem).toHaveBeenCalledWith('offreader-last-used-shelf', shelf.id);
    });

    it('should clear last used when set to null', async () => {
      const shelf = await shelfService.createShelf('Was Used');
      await shelfService.setLastUsedShelf(shelf.id);
      await shelfService.setLastUsedShelf(null);

      expect(shelfService.getLastUsedShelfId()).toBeNull();
      expect(mockRemoveItem).toHaveBeenCalledWith('offreader-last-used-shelf');
    });
  });

  describe('subscription', () => {
    it('should call listener when shelf is created', async () => {
      const listener = vi.fn();
      shelfService.subscribe(listener);

      await shelfService.createShelf('Trigger');
      expect(listener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', async () => {
      const listener = vi.fn();
      const unsub = shelfService.subscribe(listener);

      unsub();
      await shelfService.createShelf('After Unsubscribe');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple subscribers', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      shelfService.subscribe(listener1);
      shelfService.subscribe(listener2);

      await shelfService.createShelf('Multi');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });
});