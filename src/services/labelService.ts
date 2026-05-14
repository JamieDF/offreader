import { Label } from "@/types/book";
import { storageService } from "./storage";

const LABELS_STORAGE_KEY = 'offreader-labels';

class LabelService {
  private static instance: LabelService;
  private labels: Label[] = [];
  private isLoading: boolean = true;
  private listeners: Set<() => void> = new Set();

  static getInstance(): LabelService {
    if (!LabelService.instance) {
      LabelService.instance = new LabelService();
    }
    return LabelService.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.isLoading = true;
      this.notifyListeners();

      const storedLabels = await storageService.getItem(LABELS_STORAGE_KEY);
      this.labels = storedLabels ? JSON.parse(storedLabels) : [];

      this.isLoading = false;
      this.notifyListeners();
    } catch (error) {
      console.error('LabelService initialization failed:', error);
      this.isLoading = false;
      this.notifyListeners();
    }
  }

  private async persist(): Promise<void> {
    try {
      await storageService.setItem(LABELS_STORAGE_KEY, JSON.stringify(this.labels));
    } catch (error) {
      console.error('Failed to persist labels:', error);
      throw error;
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  getLabels(): Label[] {
    return [...this.labels].sort((a, b) => a.name.localeCompare(b.name));
  }

  getLabelById(id: string): Label | undefined {
    return this.labels.find(l => l.id === id);
  }

  getLabelsByIds(ids: string[]): Label[] {
    return this.labels.filter(l => ids.includes(l.id));
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async createLabel(name: string, color: string): Promise<Label> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Label name cannot be empty');
    }

    if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      throw new Error('Invalid color format');
    }

    if (this.labels.some(l => l.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error('A label with this name already exists');
    }

    const newLabel: Label = {
      id: crypto.randomUUID(),
      name: trimmedName,
      color,
    };

    this.labels.push(newLabel);
    await this.persist();
    this.notifyListeners();
    return newLabel;
  }

  async updateLabel(id: string, updates: Partial<Pick<Label, 'name' | 'color'>>): Promise<void> {
    const label = this.labels.find(l => l.id === id);
    if (!label) {
      throw new Error('Label not found');
    }

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName) {
        throw new Error('Label name cannot be empty');
      }

      const duplicate = this.labels.find(
        l => l.id !== id && l.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        throw new Error('A label with this name already exists');
      }

      label.name = trimmedName;
    }

    if (updates.color !== undefined) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(updates.color)) {
        throw new Error('Invalid color format');
      }
      label.color = updates.color;
    }

    await this.persist();
    this.notifyListeners();
  }

  async deleteLabel(id: string): Promise<void> {
    const index = this.labels.findIndex(l => l.id === id);
    if (index === -1) {
      throw new Error('Label not found');
    }

    this.labels.splice(index, 1);
    await this.persist();
    this.notifyListeners();
  }

  removeLabelFromBooks(labelId: string, books: { labelIds: string[] }[]): { labelIds: string[] }[] {
    return books.map(book => ({
      ...book,
      labelIds: book.labelIds.filter(id => id !== labelId),
    }));
  }
}

export const labelService = LabelService.getInstance();