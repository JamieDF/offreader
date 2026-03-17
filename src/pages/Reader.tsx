import { useSearchParams, useNavigate } from "react-router-dom";
import EpubReader from "@/components/EpubReader";
import { useLibrary } from "@/hooks/useLibrary";
import { useEffect, useState } from "react";

const Reader = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookId = searchParams.get("bookId");
  const { allBooks, isLoading, updateProgress } = useLibrary();
  const [isReady, setIsReady] = useState(false);

  // Navigate away if no bookId
  useEffect(() => {
    if (!bookId) {
      navigate("/");
    }
  }, [bookId, navigate]);

  // Wait for library to load
  useEffect(() => {
    if (!isLoading) {
      setIsReady(true);
    }
  }, [isLoading]);

  // Navigate away if book not found after library is ready
  useEffect(() => {
    if (isReady && bookId && allBooks.length > 0) {
      const book = allBooks.find(b => b.id === bookId);
      if (!book) {
        console.error('Book not found:', bookId);
        navigate("/");
      }
    }
  }, [isReady, bookId, allBooks, navigate]);

  if (!bookId) {
    return null;
  }

  // Show loading while library is loading
  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading book...</p>
        </div>
      </div>
    );
  }

  // Find the book in library
  const book = allBooks.find(b => b.id === bookId);
  
  if (!book) {
    return null; // Will navigate away in useEffect
  }

  return <EpubReader bookId={bookId} book={book} updateLibraryProgress={updateProgress} />;
};

export default Reader;
