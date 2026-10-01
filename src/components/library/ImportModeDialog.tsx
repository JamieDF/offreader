import { useEffect, useState } from 'react';
import { Link2, HardDrive } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImportMode } from '@/utils/importMode';

interface ImportModeDialogProps {
  isOpen: boolean;
  defaultMode: ImportMode;
  onChoose: (mode: ImportMode) => void;
  onClose: () => void;
}

const OPTIONS: { value: ImportMode; label: string; hint: string; icon: typeof Link2 }[] = [
  {
    value: 'linked',
    label: 'Link in place',
    hint: 'Read files from their current location — nothing is copied. If a file is moved or deleted, the book can be relinked.',
    icon: Link2,
  },
  {
    value: 'managed',
    label: 'Copy into library',
    hint: 'Duplicate files into OffReader storage. Books keep working even if the original file is moved or deleted.',
    icon: HardDrive,
  },
];

export function ImportModeDialog({ isOpen, defaultMode, onChoose, onClose }: ImportModeDialogProps) {
  const [mode, setMode] = useState<ImportMode>(defaultMode);

  useEffect(() => {
    if (isOpen) setMode(defaultMode);
  }, [isOpen, defaultMode]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Import books</DialogTitle>
          <DialogDescription>
            Choose how the selected files join your library.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          {OPTIONS.map(({ value, label, hint, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className={`w-full text-left px-3 py-2.5 rounded-md border-2 transition-colors flex gap-3 ${
                mode === value ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50 hover:bg-muted'
              }`}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>
              </span>
            </button>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onChoose(mode)}>Choose files…</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
