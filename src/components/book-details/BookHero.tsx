import { BookOpen } from "lucide-react";
import { Book } from "@/types/book";
import { titleCase } from "@/utils/titleCase";

interface BookHeroProps {
  book: Book;
}

export function BookHero({ book }: BookHeroProps) {
  return (
    <div className="flex flex-col items-center px-6 pt-6 pb-8">
      {/* Cover with drop shadow */}
      <div className="relative w-48 md:w-56 rounded-lg overflow-hidden shadow-2xl shadow-foreground/20">
        <div className="relative" style={{ paddingBottom: "150%" }}>
          {book.coverImage ? (
            <img
              src={book.coverImage}
              alt={titleCase(book.title)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center">
              <BookOpen className="w-16 h-16 text-primary/60" />
            </div>
          )}
        </div>
      </div>

      {/* Title and Author */}
      <div className="mt-6 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
          {titleCase(book.title)}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          by {book.author}
        </p>
      </div>
    </div>
  );
}
