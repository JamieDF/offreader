import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EditMetadataDialog } from '@/components/book-details/EditMetadataDialog';

const mockBook = {
  id: '1',
  title: 'Test Book',
  author: 'Test Author',
  coverImage: '',
  filePath: '/test.epub',
  progress: 0,
  shelfId: null,
  labelIds: [],
};

describe('EditMetadataDialog', () => {
  const onSave = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    onSave.mockClear();
    onClose.mockClear();
  });

  describe('pre-population', () => {
    it('pre-populates title, author, and description from book prop when opened', () => {
      const book = { ...mockBook, description: 'A great book' };
      render(<EditMetadataDialog isOpen={true} book={book} onSave={onSave} onClose={onClose} />);

      expect((screen.getByPlaceholderText('Book title') as HTMLInputElement).value).toBe('Test Book');
      expect((screen.getByPlaceholderText('Author name') as HTMLInputElement).value).toBe('Test Author');
      expect((screen.getByPlaceholderText('Book description') as HTMLTextAreaElement).value).toBe('A great book');
    });

    it('resets form values when re-opened with different book data', () => {
      const bookA = { ...mockBook, title: 'Book A', author: 'Author A', description: 'Desc A' };
      const { rerender } = render(
        <EditMetadataDialog isOpen={true} book={bookA} onSave={onSave} onClose={onClose} />,
      );

      const bookB = { ...mockBook, title: 'Book B', author: 'Author B', description: 'Desc B' };
      rerender(<EditMetadataDialog isOpen={true} book={bookB} onSave={onSave} onClose={onClose} />);

      expect((screen.getByPlaceholderText('Book title') as HTMLInputElement).value).toBe('Book B');
      expect((screen.getByPlaceholderText('Author name') as HTMLInputElement).value).toBe('Author B');
      expect((screen.getByPlaceholderText('Book description') as HTMLTextAreaElement).value).toBe('Desc B');
    });
  });

  describe('validation', () => {
    it('shows error when title is cleared and Save is clicked', () => {
      render(<EditMetadataDialog isOpen={true} book={mockBook} onSave={onSave} onClose={onClose} />);

      fireEvent.change(screen.getByPlaceholderText('Book title'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(screen.getByText('Title is required')).toBeDefined();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('shows error when author is cleared and Save is clicked', () => {
      render(<EditMetadataDialog isOpen={true} book={mockBook} onSave={onSave} onClose={onClose} />);

      fireEvent.change(screen.getByPlaceholderText('Author name'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(screen.getByText('Author is required')).toBeDefined();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('calls onSave with trimmed values', () => {
      render(<EditMetadataDialog isOpen={true} book={mockBook} onSave={onSave} onClose={onClose} />);

      fireEvent.change(screen.getByPlaceholderText('Book title'), { target: { value: '  Title  ' } });
      fireEvent.change(screen.getByPlaceholderText('Author name'), { target: { value: '  Author  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Title', author: 'Author' }),
      );
    });
  });

  describe('save behavior', () => {
    it('calls onSave with correct data and onClose when Save is clicked', () => {
      const book = { ...mockBook, description: 'Nice read' };
      render(<EditMetadataDialog isOpen={true} book={book} onSave={onSave} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(onSave).toHaveBeenCalledWith({ title: 'Test Book', author: 'Test Author', description: 'Nice read' });
      expect(onClose).toHaveBeenCalled();
    });

    it('does not call onSave when Cancel is clicked', () => {
      render(<EditMetadataDialog isOpen={true} book={mockBook} onSave={onSave} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles undefined description and saves as empty string', () => {
      const book = { ...mockBook };
      delete (book as Record<string, unknown>).description;
      render(<EditMetadataDialog isOpen={true} book={book} onSave={onSave} onClose={onClose} />);

      expect((screen.getByPlaceholderText('Book description') as HTMLTextAreaElement).value).toBe('');

      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ description: '' }),
      );
    });
  });
});
