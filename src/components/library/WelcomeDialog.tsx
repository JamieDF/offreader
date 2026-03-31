import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BookOpen, Upload, WifiOff } from 'lucide-react';
import { type WelcomeDialogMode } from '@/hooks/useWelcomeDialog';

interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

interface WelcomeDialogProps {
  mode: WelcomeDialogMode;
  lastVersion: string | null;
  onDismiss: () => void;
}

export function WelcomeDialog({ mode, lastVersion, onDismiss }: WelcomeDialogProps) {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    if (!mode) return;
    fetch('/changelog.json')
      .then(r => r.json())
      .then(setChangelog)
      .catch(() => {});
  }, [mode]);

  const { missed, rest } = useMemo(() => {
    if (!changelog.length) return { missed: [], rest: [] };
    if (!lastVersion) return { missed: changelog.slice(0, 1), rest: changelog.slice(1) };
    const cutoff = changelog.findIndex(e => e.version === lastVersion);
    const pivot = cutoff === -1 ? changelog.length : cutoff;
    return { missed: changelog.slice(0, pivot), rest: changelog.slice(pivot) };
  }, [changelog, lastVersion]);

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col gap-0">
        <DialogHeader className="pb-4">
          <DialogTitle>
            {mode === 'first-time' ? 'Welcome to OffReader' : 'Welcome back'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {mode === 'first-time' ? <FirstTimeContent /> : <WelcomeBackContent />}
          {changelog.length > 0 && <WhatsNewSection missed={missed} rest={rest} />}
        </div>

        <div className="pt-4 mt-4 border-t">
          <Button onClick={onDismiss} className="w-full">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FirstTimeContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        OffReader is a private ebook reader. No account, no sync — your books and reading data stay entirely on your device.
      </p>
      <ul className="space-y-3">
        <li className="flex items-start gap-3 text-sm">
          <Upload className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <span>Import EPUB or MOBI files directly from your device</span>
        </li>
        <li className="flex items-start gap-3 text-sm">
          <BookOpen className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <span>Track progress, bookmarks, and reading streaks across your library</span>
        </li>
        <li className="flex items-start gap-3 text-sm">
          <WifiOff className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <span>Nothing is ever sent to a server — no tracking, no cloud storage</span>
        </li>
      </ul>
    </div>
  );
}

function WelcomeBackContent() {
  return (
    <p className="text-sm text-muted-foreground">
      Good to have you back. Here's what's changed since your last visit.
    </p>
  );
}

function ChangelogEntryRow({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-primary">v{entry.version}</span>
        <span className="text-xs text-muted-foreground">{entry.date}</span>
      </div>
      <ul className="space-y-1.5">
        {entry.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-2 w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WhatsNewSection({ missed, rest }: { missed: ChangelogEntry[]; rest: ChangelogEntry[] }) {
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">What's new</h3>
      {missed.map(entry => <ChangelogEntryRow key={entry.version} entry={entry} />)}
      {rest.length > 0 && (
        showAll
          ? rest.map(entry => <ChangelogEntryRow key={entry.version} entry={entry} />)
          : (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Show {rest.length} older {rest.length === 1 ? 'release' : 'releases'}
            </button>
          )
      )}
    </div>
  );
}
