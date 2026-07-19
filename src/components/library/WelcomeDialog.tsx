import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AboutContent, ChangelogAccordion } from '@/components/library/AboutContent';
import { Bug, ExternalLink, Star } from 'lucide-react';
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
  const title = mode === 'first-time'
    ? 'Welcome to OffReader'
    : 'Welcome back';

  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);

  // Fetch the changelog whenever we actually need to show it (welcome-back).
  useEffect(() => {
    if (mode !== 'welcome-back') return;
    fetch('/changelog.json')
      .then(r => r.json())
      .then(setChangelog)
      .catch(() => {});
  }, [mode]);

  // Compute which versions were released after lastVersion (these are what
  // the user missed). If lastVersion isn't in the changelog, show everything.
  const missedVersions = (() => {
    if (mode !== 'welcome-back' || !changelog.length) return undefined;
    if (!lastVersion) return changelog.map(e => e.version);
    const cutoff = changelog.findIndex(e => e.version === lastVersion);
    const pivot = cutoff === -1 ? changelog.length : cutoff;
    return changelog.slice(0, pivot).map(e => e.version);
  })();

  const isWelcomeBack = mode === 'welcome-back';

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {isWelcomeBack && (
            <DialogDescription>
              Here's what's changed since v{lastVersion ?? 'your last visit'}.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {isWelcomeBack ? (
            <>
              {missedVersions && missedVersions.length > 0 ? (
                <ChangelogAccordion
                  entries={changelog}
                  versions={missedVersions}
                  defaultExpandedVersions={missedVersions}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No notable changes recorded for this update.
                </p>
              )}

              <div className="mt-6 pt-4 border-t space-y-2">
                <a
                  href="https://play.google.com/store/apps/details?id=com.offreader.reader"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between text-sm text-foreground hover:text-primary transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    Rate this app
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                <a
                  href="https://github.com/JamieDF/offreader/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between text-sm text-foreground hover:text-primary transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-muted-foreground" />
                    Report a bug
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              </div>
            </>
          ) : (
            <AboutContent showChangelog={false} />
          )}
        </div>

        <div className="px-6 py-4 mt-4 border-t shrink-0">
          <Button onClick={onDismiss} className="w-full">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}