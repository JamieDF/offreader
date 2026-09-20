import { ToastContainer } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useWelcomeDialog } from "@/hooks/useWelcomeDialog";
import { useOnboardingTour, OnboardingTourProvider } from "@/hooks/useOnboardingTour";
import { WelcomeDialog } from "@/components/library/WelcomeDialog";
import { OnboardingTour } from "@/components/library/onboarding/OnboardingTour";
import { Loader2 } from "lucide-react";
import Library from "./pages/Library";
import BookDetails from "./pages/BookDetails";
import Reader from "./pages/Reader";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import { libraryService } from "@/services/LibraryService";
import { shelfService } from "@/services/shelfService";
import { labelService } from "@/services/labelService";
import { ReaderSettingsProvider } from "@/hooks/useReaderSettings";
import { ElectronTitleBar } from "@/components/electron/ElectronTitleBar";

const queryClient = new QueryClient();

// The Electron build is frameless — the app draws its own titlebar and the
// shell remaps page-level `h-screen` to the area below it (see index.css).
const isElectron = typeof window !== 'undefined' && window.Capacitor?.getPlatform() === 'electron';

const AppContent = () => {
  const [libraryReady, setLibraryReady] = useState(false);
  const { mode, lastVersion, dismiss } = useWelcomeDialog();
  const { start: startTour } = useOnboardingTour();

  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize services in parallel
        await Promise.all([
          libraryService.initialize(),
          shelfService.initialize(),
          labelService.initialize(),
        ]);
      } catch (error) {
        console.error('App: Service initialization failed:', error);
      } finally {
        setLibraryReady(true);
      }
    };

    initialize();
  }, []);

  // Dismiss the welcome dialog and launch the onboarding tour.
  const handleStartTour = useCallback(async () => {
    await dismiss();
    startTour();
  }, [dismiss, startTour]);

  if (!libraryReady) {
    return (
      <div className={isElectron ? 'electron-shell flex h-screen flex-col' : 'contents'}>
        <ElectronTitleBar />
        <div className="flex min-h-0 flex-1 items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading library...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ReaderSettingsProvider>
        <TooltipProvider>
          <div className={isElectron ? 'electron-shell flex h-screen flex-col' : 'contents'}>
            <ElectronTitleBar />
            <div className={isElectron ? 'min-h-0 flex-1 overflow-hidden' : 'contents'}>
              <ToastContainer />
              <WelcomeDialog
                mode={mode}
                lastVersion={lastVersion}
                onDismiss={dismiss}
                onStartTour={handleStartTour}
              />
              <OnboardingTour />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Library />} />
                  <Route path="/book/:bookId" element={<BookDetails />} />
                  <Route path="/reader" element={<Reader />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/privacy" element={<Privacy />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </div>
          </div>
        </TooltipProvider>
      </ReaderSettingsProvider>
    </QueryClientProvider>
  );
};

const App = () => (
  <OnboardingTourProvider>
    <AppContent />
  </OnboardingTourProvider>
);

export default App;