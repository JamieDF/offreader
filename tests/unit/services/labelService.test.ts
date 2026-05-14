import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Label } from '@/types/book';

// Mock storage service
const mockGetItem = vi.fn();
const mockSetItem = vi.fn();

vi.mock('@/services/storage', () => ({
  storageService: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

// Import after mock
import { labelService } from '@/services/labelService';

describe('LabelService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    // Initialize the service fresh
    await labelService.initialize();
  });

  describe('initialization', () => {
    it('should load labels from storage on init', async () => {
      const storedLabels: Label[] = [
        { id: 'label-1', name: 'Fiction', color: '#FF0000' },
        { id: 'label-2', name: 'Sci-Fi', color: '#00FF00' },
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(storedLabels));

      await labelService.initialize();

      const labels = labelService.getLabels();
      expect(labels).toHaveLength(2);
      expect(labels[0].name).toBe('Fiction');
      expect(labels[1].name).toBe('Sci-Fi');
    });

    it('should handle missing storage gracefully', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      await labelService.initialize();

      expect(labelService.getLabels()).toEqual([]);
    });
  });

  describe('createLabel', () => {
    it('should create a new label with valid color', async () => {
      const label = await labelService.createLabel('My Label', '#FF5733');

      expect(label.id).toBeDefined();
      expect(label.name).toBe('My Label');
      expect(label.color).toBe('#FF5733');
    });

    it('should trim whitespace from label name', async () => {
      const label = await labelService.createLabel('  Trimmed Label  ', '#FF0000');

      expect(label.name).toBe('Trimmed Label');
    });

    it('should throw error for empty label name', async () => {
      await expect(labelService.createLabel('', '#FF0000')).rejects.toThrow('Label name cannot be empty');
      await expect(labelService.createLabel('   ', '#FF0000')).rejects.toThrow('Label name cannot be empty');
    });

    it('should throw error for invalid color format - missing hash', async () => {
      await expect(labelService.createLabel('Bad Color', 'FF0000')).rejects.toThrow('Invalid color format');
    });

    it('should throw error for invalid color format - wrong length', async () => {
      await expect(labelService.createLabel('Bad Color', '#FF00')).rejects.toThrow('Invalid color format');
      await expect(labelService.createLabel('Bad Color', '#FFFFFFF')).rejects.toThrow('Invalid color format');
    });

    it('should throw error for invalid color format - invalid chars', async () => {
      await expect(labelService.createLabel('Bad Color', '#GGGGGG')).rejects.toThrow('Invalid color format');
    });

    it('should accept valid hex colors - uppercase', async () => {
      const label = await labelService.createLabel('Valid', '#ABCDEF');
      expect(label.color).toBe('#ABCDEF');
    });

    it('should accept valid hex colors - lowercase', async () => {
      const label = await labelService.createLabel('Valid', '#abcdef');
      expect(label.color).toBe('#abcdef');
    });

    it('should throw error for duplicate label name (case insensitive)', async () => {
      await labelService.createLabel('My Label', '#FF0000');
      await expect(labelService.createLabel('my label', '#00FF00')).rejects.toThrow('A label with this name already exists');
      await expect(labelService.createLabel('My Label', '#00FF00')).rejects.toThrow('A label with this name already exists');
    });

    it('should persist to storage', async () => {
      await labelService.createLabel('Test Label', '#FF0000');

      expect(mockSetItem).toHaveBeenCalledWith(
        'offreader-labels',
        expect.stringContaining('Test Label')
      );
    });

    it('should notify listeners after creation', async () => {
      const listener = vi.fn();
      const unsub = labelService.subscribe(listener);

      await labelService.createLabel('New Label', '#FF0000');
      expect(listener).toHaveBeenCalled();

      unsub();
    });
  });

  describe('getLabels', () => {
    it('should return labels sorted by name', async () => {
      await labelService.createLabel('Zebra Label', '#FF0000');
      await labelService.createLabel('Alpha Label', '#00FF00');
      await labelService.createLabel('Middle Label', '#0000FF');

      const labels = labelService.getLabels();

      expect(labels[0].name).toBe('Alpha Label');
      expect(labels[1].name).toBe('Middle Label');
      expect(labels[2].name).toBe('Zebra Label');
    });

    it('should return empty array when no labels exist', () => {
      const labels = labelService.getLabels();

      expect(labels).toEqual([]);
    });
  });

  describe('getLabelById', () => {
    it('should return label by id', async () => {
      const created = await labelService.createLabel('Find Me', '#FF0000');
      const found = labelService.getLabelById(created.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('Find Me');
    });

    it('should return undefined for non-existent id', () => {
      const found = labelService.getLabelById('non-existent');

      expect(found).toBeUndefined();
    });
  });

  describe('getLabelsByIds', () => {
    it('should return labels matching the provided ids', async () => {
      const label1 = await labelService.createLabel('Label One', '#FF0000');
      const label2 = await labelService.createLabel('Label Two', '#00FF00');
      const label3 = await labelService.createLabel('Label Three', '#0000FF');

      const found = labelService.getLabelsByIds([label1.id, label3.id]);

      expect(found).toHaveLength(2);
      expect(found.map(l => l.name)).toContain('Label One');
      expect(found.map(l => l.name)).toContain('Label Three');
      expect(found.map(l => l.name)).not.toContain('Label Two');
    });

    it('should return empty array when no ids match', () => {
      const found = labelService.getLabelsByIds(['non-existent-1', 'non-existent-2']);

      expect(found).toEqual([]);
    });
  });

  describe('updateLabel', () => {
    it('should update label name', async () => {
      const label = await labelService.createLabel('Original', '#FF0000');
      await labelService.updateLabel(label.id, { name: 'Updated' });

      expect(labelService.getLabelById(label.id)!.name).toBe('Updated');
    });

    it('should update label color', async () => {
      const label = await labelService.createLabel('Test', '#FF0000');
      await labelService.updateLabel(label.id, { color: '#00FF00' });

      expect(labelService.getLabelById(label.id)!.color).toBe('#00FF00');
    });

    it('should throw error when updating to empty name', async () => {
      const label = await labelService.createLabel('Test', '#FF0000');
      await expect(labelService.updateLabel(label.id, { name: '' })).rejects.toThrow('Label name cannot be empty');
    });

    it('should throw error for duplicate name on update', async () => {
      await labelService.createLabel('Label A', '#FF0000');
      const labelB = await labelService.createLabel('Label B', '#00FF00');

      await expect(labelService.updateLabel(labelB.id, { name: 'Label A' })).rejects.toThrow('A label with this name already exists');
    });

    it('should throw error for invalid color on update', async () => {
      const label = await labelService.createLabel('Test', '#FF0000');
      await expect(labelService.updateLabel(label.id, { color: 'invalid' })).rejects.toThrow('Invalid color format');
    });

    it('should throw error when label not found', async () => {
      await expect(labelService.updateLabel('non-existent', { name: 'New Name' })).rejects.toThrow('Label not found');
    });

    it('should persist to storage after update', async () => {
      const label = await labelService.createLabel('Test', '#FF0000');
      mockSetItem.mockClear();

      await labelService.updateLabel(label.id, { name: 'Updated' });

      expect(mockSetItem).toHaveBeenCalled();
    });
  });

  describe('deleteLabel', () => {
    it('should delete label by id', async () => {
      const label = await labelService.createLabel('To Delete', '#FF0000');
      await labelService.deleteLabel(label.id);

      expect(labelService.getLabelById(label.id)).toBeUndefined();
    });

    it('should throw error when label not found', async () => {
      await labelService.createLabel('Keep Me', '#FF0000');

      await expect(labelService.deleteLabel('non-existent')).rejects.toThrow('Label not found');
    });

    it('should notify listeners after deletion', async () => {
      const label = await labelService.createLabel('To Delete', '#FF0000');
      const listener = vi.fn();
      labelService.subscribe(listener);

      await labelService.deleteLabel(label.id);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('subscription', () => {
    it('should call listener when label is created', async () => {
      const listener = vi.fn();
      labelService.subscribe(listener);

      await labelService.createLabel('Trigger', '#FF0000');
      expect(listener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', async () => {
      const listener = vi.fn();
      const unsub = labelService.subscribe(listener);

      unsub();
      await labelService.createLabel('After Unsubscribe', '#FF0000');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple subscribers', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      labelService.subscribe(listener1);
      labelService.subscribe(listener2);

      await labelService.createLabel('Multi', '#FF0000');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });
});