import { Search, Settings2, ArrowUpDown, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { SortOption } from "@/hooks/useLibrary";

interface LibraryHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenInsights?: () => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recently Read" },
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "progress", label: "Progress" },
];

export function LibraryHeader({
  searchQuery,
  onSearchChange,
  onToggleDarkMode,
  onOpenInsights,
  sortBy,
  onSortChange,
}: LibraryHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const currentSort = sortOptions.find((o) => o.value === sortBy);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Title or Search Input */}
        <div className="flex-1 flex items-center">
          {isSearchOpen ? (
            <Input
              type="text"
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 w-full max-w-sm animate-fade-in"
              autoFocus
              onBlur={() => {
                if (!searchQuery) setIsSearchOpen(false);
              }}
            />
          ) : (
            <div className="flex items-center gap-2">
              <img src="/offReader.svg" alt="OffReader" className="h-12 w-12" />
              <h1 className="text-xl font-semibold text-foreground">OffReader</h1>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowUpDown className="h-5 w-5" />
                <span className="sr-only">Sort by {currentSort?.label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                  className={sortBy === option.value ? "bg-muted font-medium" : ""}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isSearchOpen && searchQuery) {
                onSearchChange("");
              }
              setIsSearchOpen(!isSearchOpen);
            }}
            className="h-9 w-9"
          >
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenInsights}
            className="h-9 w-9"
          >
            <LineChart className="h-5 w-5" />
            <span className="sr-only">Reading Insights</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleDarkMode}
            className="h-9 w-9"
          >
            <Settings2 className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
