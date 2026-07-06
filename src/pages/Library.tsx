import { useNavigate } from "react-router-dom";
import { LibraryView } from "@/components/library/LibraryView";
import { Book } from "@/types/book";

const Library = () => {
  const navigate = useNavigate();

  const handleBookSelect = (book: Book) => {
    // Navigate to book details screen
    navigate(`/book/${book.id}`);
  };

  return <LibraryView onBookSelect={handleBookSelect} />;
};

export default Library;