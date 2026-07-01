import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Privacy = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/about');
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="shrink-0 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center h-14 px-4 gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-semibold">Privacy Policy</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
          <section className="space-y-2 pt-2">
            <h1 className="text-2xl font-bold">OffReader Privacy Policy</h1>
            <p className="text-xs text-muted-foreground">Last updated: July 2026</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Overview</h2>
            <p className="text-sm text-muted-foreground">
              OffReader is an offline ebook reader. We do not collect, store, or transmit any
              personal data. Everything — your books, reading progress, bookmarks, and settings —
              stays on your device.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Data We Collect</h2>
            <p className="text-sm text-muted-foreground">
              None. OffReader does not collect any personal information. No account is required and
              no data is sent to any server.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Data Stored on Your Device</h2>
            <p className="text-sm text-muted-foreground">
              Book files, reading progress, bookmarks, library metadata, and app preferences are
              stored locally on your device using the app's internal storage. This data never leaves
              your device and is not accessible to us.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Permissions</h2>
            <p className="text-sm text-muted-foreground">
              OffReader requests only the following permission:
            </p>
            <ul className="space-y-1">
              <li className="text-sm text-muted-foreground flex gap-2">
                <span className="shrink-0">·</span>
                <span>
                  <strong className="text-foreground">Internet</strong> — used solely for delivering
                  the app and its updates. The app functions fully offline once installed. No data is
                  transmitted during use.
                </span>
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Third-Party Services</h2>
            <p className="text-sm text-muted-foreground">
              OffReader does not use any third-party analytics, advertising, or tracking services. We
              do not share data with any third parties because we collect none.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Children's Privacy</h2>
            <p className="text-sm text-muted-foreground">
              OffReader is suitable for users of all ages. No personal data is collected from anyone,
              including children.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Data Security</h2>
            <p className="text-sm text-muted-foreground">
              Since all data remains on your device under your control, the security of your data
              depends on your device's built-in protections.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground">
              Any updates to this policy will be included with future app updates.
            </p>
          </section>

          <section className="space-y-2 border-t border-border pt-8">
            <h2 className="text-sm font-semibold">Contact</h2>
            <p className="text-sm text-muted-foreground">
              Questions about this policy? Email{' '}
              <a
                href="mailto:mail@offreader.com"
                className="text-primary underline hover:text-primary/90"
              >
                mail@offreader.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
