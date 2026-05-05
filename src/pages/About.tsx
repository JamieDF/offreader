import { ArrowLeft, Bug, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

const About = () => {
  const navigate = useNavigate();
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    fetch('/changelog.json')
      .then(r => r.json())
      .then(setChangelog)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center h-14 px-4 gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-semibold">About</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-10 space-y-10">
        <section className="flex flex-col items-center text-center gap-2 pt-2">
          <img src="/offReader.svg" alt="OffReader" className="h-16 w-16" />
          <h1 className="text-2xl font-bold">OffReader</h1>
          <p className="text-muted-foreground text-sm">A simple ebook library and reader using Foliate.js. No account, no cloud — just you and your books.</p>
          <span className="text-xs text-muted-foreground">v{__APP_VERSION__}</span>
        </section>

        {changelog.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Changelog</h2>
            {changelog.map(entry => (
              <div key={entry.version} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">v{entry.version}</span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
                <ul className="space-y-1">
                  {entry.items.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="shrink-0">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-3 border-t border-border pt-8">
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
          <a
            href="https://jamie-fraser.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between text-sm text-foreground hover:text-primary transition-colors"
          >
            <span>Built by Jamie Fraser</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </section>
      </main>
    </div>
  );
};

export default About;
