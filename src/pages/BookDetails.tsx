import { useParams, useNavigate } from "react-router-dom";
import { BookDetailsView } from "@/components/book-details/BookDetailsView";
import { useLibrary } from "@/hooks/useLibrary";
import { useEffect } from "react";

const BookDetails = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { allBooks, removeBook } = useLibrary();

  const book = allBooks.find((b) => b.id === bookId);

  useEffect(() => {
    // If we have a bookId but no books yet, wait a bit then check again
    if (bookId && allBooks.length === 0) {
      const timer = setTimeout(() => {
        // The useLibrary hook will update allBooks when books are loaded
      }, 500);
      return () => clearTimeout(timer);
    }
    
    // If we have books but still can't find the book, navigate away
    if (bookId && allBooks.length > 0 && !book) {
      navigate("/");
    }
  }, [book, bookId, navigate, allBooks.length]);

  // If no books yet, show loading
  if (allBooks.length === 0) {
    return <div>Loading...</div>;
  }

  if (!book) {
    return null;
  }

  return <BookDetailsView book={book} onRemove={removeBook} />;
};

export default BookDetails;
