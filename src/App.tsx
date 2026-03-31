import { ToastContainer } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { useWelcomeDialog } from "@/hooks/useWelcomeDialog";
import { WelcomeDialog } from "@/components/library/WelcomeDialog";
import { Loader2 } from "lucide-react";
import Library from "./pages/Library";
import BookDetails from "./pages/BookDetails";
import Reader from "./pages/Reader";
import NotFound from "./pages/NotFound";
import { libraryService } from "@/services/LibraryService";
import { ReaderSettingsProvider } from "@/hooks/useReaderSettings";

const queryClient = new QueryClient();

const App = () => {
  const [libraryReady, setLibraryReady] = useState(false);
  const { mode, lastVersion, dismiss } = useWelcomeDialog();

  useEffect(() => {
    // Initialize library once on app start
    libraryService.initialize().then(() => {
      setLibraryReady(true);
    }).catch((error) => {
      console.error('App: Library initialization failed:', error);
      setLibraryReady(true); // Still show app even if library fails
    });
  }, []);
  
  if (!libraryReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading library...</p>
        </div>
      </div>
    );
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <ReaderSettingsProvider>
        <TooltipProvider>
          <ToastContainer />
          <WelcomeDialog mode={mode} lastVersion={lastVersion} onDismiss={dismiss} />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Library />} />
              <Route path="/book/:bookId" element={<BookDetails />} />
              <Route path="/reader" element={<Reader />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ReaderSettingsProvider>
    </QueryClientProvider>
  );
};

export default App;
