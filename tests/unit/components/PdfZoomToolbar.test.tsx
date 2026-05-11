import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PdfZoomToolbar from '@/components/reader/PdfZoomToolbar';

describe('PdfZoomToolbar', () => {
  const onZoomChange = vi.fn();

  beforeEach(() => onZoomChange.mockClear());

  describe('zoom label', () => {
    it('shows "Fit Page" for fit-page zoom', () => {
      render(<PdfZoomToolbar zoom="fit-page" onZoomChange={onZoomChange} isVisible={true} />);
      expect(screen.getByTestId('zoom-label').textContent).toBe('Fit Page');
    });

    it('shows "Fit Width" for fit-width zoom', () => {
      render(<PdfZoomToolbar zoom="fit-width" onZoomChange={onZoomChange} isVisible={true} />);
      expect(screen.getByTestId('zoom-label').textContent).toBe('Fit Width');
    });

    it('shows percentage for numeric zoom', () => {
      render(<PdfZoomToolbar zoom={1.5} onZoomChange={onZoomChange} isVisible={true} />);
      expect(screen.getByTestId('zoom-label').textContent).toBe('150%');
    });

    it('rounds percentage to nearest integer', () => {
      render(<PdfZoomToolbar zoom={1.333} onZoomChange={onZoomChange} isVisible={true} />);
      expect(screen.getByTestId('zoom-label').textContent).toBe('133%');
    });
  });

  describe('preset buttons', () => {
    it('calls onZoomChange with fit-page when Fit Page is clicked', () => {
      render(<PdfZoomToolbar zoom="fit-width" onZoomChange={onZoomChange} isVisible={true} />);
      fireEvent.click(screen.getByRole('button', { name: 'Fit Page' }));
      expect(onZoomChange).toHaveBeenCalledWith('fit-page');
    });

    it('calls onZoomChange with fit-width when Fit Width is clicked', () => {
      render(<PdfZoomToolbar zoom="fit-page" onZoomChange={onZoomChange} isVisible={true} />);
      fireEvent.click(screen.getByRole('button', { name: 'Fit Width' }));
      expect(onZoomChange).toHaveBeenCalledWith('fit-width');
    });
  });

  describe('zoom in / zoom out', () => {
    it('increments numeric zoom by 0.1 on zoom in', () => {
      render(<PdfZoomToolbar zoom={1} onZoomChange={onZoomChange} isVisible={true} />);
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(onZoomChange).toHaveBeenCalledWith(1.1);
    });

    it('decrements numeric zoom by 0.1 on zoom out', () => {
      render(<PdfZoomToolbar zoom={1} onZoomChange={onZoomChange} isVisible={true} />);
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
      expect(onZoomChange).toHaveBeenCalledWith(0.9);
    });

    it('uses 1 as base when zoom is a named mode', () => {
      render(<PdfZoomToolbar zoom="fit-page" onZoomChange={onZoomChange} isVisible={true} />);
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(onZoomChange).toHaveBeenCalledWith(1.1);
    });

    it('clamps zoom in to ZOOM_MAX (4) when one step away', () => {
      render(<PdfZoomToolbar zoom={3.9} onZoomChange={onZoomChange} isVisible={true} />);
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(onZoomChange).toHaveBeenCalledWith(4);
    });

    it('clamps zoom out to ZOOM_MIN (0.25) when one step away', () => {
      render(<PdfZoomToolbar zoom={0.35} onZoomChange={onZoomChange} isVisible={true} />);
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
      expect(onZoomChange).toHaveBeenCalledWith(0.25);
    });

    it('disables zoom out at minimum zoom', () => {
      render(<PdfZoomToolbar zoom={0.25} onZoomChange={onZoomChange} isVisible={true} />);
      expect((screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('disables zoom in at maximum zoom', () => {
      render(<PdfZoomToolbar zoom={4} onZoomChange={onZoomChange} isVisible={true} />);
      expect((screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('enables zoom out above minimum zoom', () => {
      render(<PdfZoomToolbar zoom={1} onZoomChange={onZoomChange} isVisible={true} />);
      expect((screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('enables both zoom buttons for named zoom modes', () => {
      render(<PdfZoomToolbar zoom="fit-page" onZoomChange={onZoomChange} isVisible={true} />);
      expect((screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement).disabled).toBe(false);
      expect((screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('visibility', () => {
    it('has pointer-events-none class when not visible', () => {
      render(<PdfZoomToolbar zoom="fit-page" onZoomChange={onZoomChange} isVisible={false} />);
      expect(screen.getByTestId('pdf-zoom-toolbar').className).toContain('pointer-events-none');
    });

    it('does not have pointer-events-none class when visible', () => {
      render(<PdfZoomToolbar zoom="fit-page" onZoomChange={onZoomChange} isVisible={true} />);
      expect(screen.getByTestId('pdf-zoom-toolbar').className).not.toContain('pointer-events-none');
    });
  });
});
