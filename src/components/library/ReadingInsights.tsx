import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReadingStats } from "@/hooks/useReadingStats";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { formatDuration } from "@/utils/statsCalculator";
import { Flame, Clock, Calendar, BookOpen } from "lucide-react";
import { libraryService } from "@/services/LibraryService";

interface ReadingInsightsProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReadingInsights({ isOpen, onOpenChange }: ReadingInsightsProps) {
  const { stats, isLoaded } = useReadingStats();
  const libraryBooks = libraryService.getBooks();

  if (!isLoaded) return null;

  // Get recently read books from sessions
  const recentSessions = [...stats.sessions]
    .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
    .slice(0, 5); // Last 5 sessions

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col" autoFocus={false}>
        <DialogHeader className="flex-row items-center justify-between pr-9">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Reading Insights
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 flex-1 overflow-y-auto space-y-6">
          {/* Summary Cards */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>Reading Stats</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <Clock className="w-5 h-5 mx-auto mb-2 text-primary" />
                <p className="text-sm">Total Time</p>
                <p className="text-sm font-medium">{formatDuration(stats.totalReadingTimeMs)}</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <Flame className="w-5 h-5 mx-auto mb-2 text-orange-500" />
                <p className="text-sm">Current Streak</p>
                <p className="text-sm font-medium">{stats.currentStreak} Days</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <Calendar className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                <p className="text-sm">Longest Streak</p>
                <p className="text-sm font-medium">{stats.longestStreak} Days</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <BookOpen className="w-5 h-5 mx-auto mb-2 text-green-500" />
                <p className="text-sm">Sessions</p>
                <p className="text-sm font-medium">{stats.sessions.length}</p>
              </div>
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Reading Consistency</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <ActivityHeatmap />
            </div>
          </div>

          {/* Recent Activity List */}
          {recentSessions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Recent Sessions</span>
              </div>
              <div className="space-y-2">
                {recentSessions.map(session => {
                  const book = libraryBooks.find(b => b.id === session.bookId);
                  const duration = formatDuration(session.durationMs);
                  const pagesRead = Math.max(0, session.endProgress - session.startProgress);
                  
                  return (
                    <div key={session.id} className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{book?.title || "Unknown Book"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {new Date(session.endTime).toLocaleString(undefined, { 
                              weekday: 'short', month: 'short', day: 'numeric', 
                              hour: 'numeric', minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-primary">{duration}</p>
                          {pagesRead > 0 && (
                            <p className="text-xs text-muted-foreground">
                              +{pagesRead.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
