import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { BookOpen, ExternalLink, Library, Tag, Upload, WifiOff } from 'lucide-react';

interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

interface BookSource {
  name: string;
  url: string;
  description: string;
}

const BOOK_SOURCES: BookSource[] = [
  {
    name: 'Project Gutenberg',
    url: 'https://www.gutenberg.org',
    description: '70,000+ free public-domain ebooks. The classic starting point.',
  },
  {
    name: 'Standard Ebooks',
    url: 'https://standardebooks.org',
    description: 'Carefully typeset, public-domain editions. Quality over quantity.',
  },
  {
    name: 'ManyBooks',
    url: 'https://manybooks.net',
    description: 'Large catalog with a friendly discovery interface.',
  },
  {
    name: 'Librivox',
    url: 'https://librivox.org',
    description: 'Free public-domain audiobooks. Great for long drives.',
  },
];

interface AboutContentProps {
  /** Whether to render the Changelog section. Defaults to true. */
  showChangelog?: boolean;
  /** Restrict the changelog to these versions (and pre-expand them). */
  changelogVersions?: string[];
}

export function ChangelogAccordion({
  entries,
  defaultExpandedVersions,
  versions,
}: {
  entries: ChangelogEntry[];
  /** Versions to pre-expand. If omitted, everything stays collapsed. */
  defaultExpandedVersions?: string[];
  /** If provided, only show entries whose version is in this list. */
  versions?: string[];
}) {
  const visible = versions ? entries.filter(e => versions.includes(e.version)) : entries;
  if (!visible.length) return null;
  return (
    <Accordion type="multiple" defaultValue={defaultExpandedVersions} className="w-full">
      {visible.map(entry => (
        <AccordionItem key={entry.version} value={entry.version}>
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              <span className="font-semibold">v{entry.version}</span>
              <span className="text-xs text-muted-foreground font-normal">{entry.date}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1.5 pt-1">
              {entry.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-2 w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function AboutContent({
  showChangelog = true,
  changelogVersions,
}: AboutContentProps = {}) {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    fetch('/changelog.json')
      .then(r => r.json())
      .then(setChangelog)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What it is</h2>
        <p className="text-sm text-muted-foreground">
          OffReader is a private ebook reader. No account, no sync. Your books and reading data stay entirely on your device.
        </p>
        <ul className="space-y-3 pt-1">
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
            <span>Nothing is ever sent to a server. No tracking, no cloud storage</span>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">How to use it</h2>
        <p className="text-sm text-muted-foreground">
          Tap the <span className="text-foreground font-medium">+</span> button on your library to import an EPUB or MOBI file. Open a book to start reading. Your progress saves automatically as you turn pages.
        </p>
        <p className="text-sm text-muted-foreground">
          Use shelves to group books by project (like "Research" or "Weekend reading") and labels to tag them by mood, genre, or anything else.
        </p>
        <ul className="space-y-3 pt-1">
          <li className="flex items-start gap-3 text-sm">
            <Library className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>Open Manage Library to create and switch between shelves</span>
          </li>
          <li className="flex items-start gap-3 text-sm">
            <Tag className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>Apply multiple labels to a book from its details page</span>
          </li>
          <li className="flex items-start gap-3 text-sm">
            <BookOpen className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>Tap a book cover to resume where you left off</span>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Where to get books</h2>
        <p className="text-sm text-muted-foreground">
          OffReader doesn't sell or recommend books. Here are some good places to find free, legally shared ones.
        </p>
        <ul className="space-y-1">
          {BOOK_SOURCES.map(source => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start justify-between gap-4 py-3 px-1 -mx-1 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="text-sm font-medium text-foreground">{source.name}</div>
                  <div className="text-xs text-muted-foreground">{source.description}</div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      {showChangelog && changelog.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Changelog</h2>
          <ChangelogAccordion entries={changelog} versions={changelogVersions} />
        </section>
      )}
    </div>
  );
}