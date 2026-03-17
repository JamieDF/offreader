import React, { useRef, useEffect } from "react";
import { useReadingStats } from "@/hooks/useReadingStats";
import { generateHeatmapData, formatDuration, ActivityLevel } from "@/utils/statsCalculator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const WEEKS_TO_SHOW = 52; // Full year

export function ActivityHeatmap() {
  const { stats, isLoaded } = useReadingStats();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the right to show the most recent days on mount/load
  useEffect(() => {
    if (isLoaded && scrollRef.current) {
      // Small timeout to ensure rendering is complete before scrolling
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, stats.sessions.length]);

  if (!isLoaded) return <div className="h-[120px] animate-pulse bg-muted rounded-md w-full" />;

  const heatmapData = generateHeatmapData(stats.dailyStats, WEEKS_TO_SHOW * 7);
  const days = heatmapData.days;

  // Split into weeks (columns)
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Calculate month labels
  const monthLabels: { month: string; colIndex: number }[] = [];
  let currentMonth = -1;
  
  weeks.forEach((week, index) => {
    if (week.length > 0) {
      const date = new Date(week[0].date);
      const month = date.getMonth();
      if (month !== currentMonth) {
        monthLabels.push({
          month: date.toLocaleString('default', { month: 'short' }),
          colIndex: index
        });
        currentMonth = month;
      }
    }
  });

  // Activity level color classes based on theme
  const getLevelColor = (level: ActivityLevel) => {
    switch (level) {
      case 0: return "bg-muted/30 hover:bg-muted/50";
      case 1: return "bg-primary/30 hover:bg-primary/40";
      case 2: return "bg-primary/50 hover:bg-primary/60";
      case 3: return "bg-primary/70 hover:bg-primary/80";
      case 4: return "bg-primary hover:bg-primary/90";
      default: return "bg-muted/30";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="w-full relative">
      <div className="w-full flex flex-col">
        {/* Scrollable Container just for the heatmap grid */}
        <div ref={scrollRef} className="w-full overflow-x-auto pb-2 custom-scrollbar scroll-smooth">
          <div className="min-w-max pr-8 md:pr-4 pb-2">
            <div className="flex gap-2 items-start w-full pr-[40px] md:pr-0">
              {/* Day Labels */}
              <div className="flex flex-col gap-[2px] text-[10px] text-muted-foreground mt-[18px] sticky left-0 bg-card z-10 pr-1 shrink-0">
                <div className="h-[12px] leading-[12px] flex items-center">Mon</div>
                <div className="h-[12px] leading-[12px] mt-[14px] flex items-center">Wed</div>
                <div className="h-[12px] leading-[12px] mt-[14px] flex items-center">Fri</div>
              </div>

              <div className="flex flex-col w-full">
                {/* Month Labels */}
                <div className="relative h-4 w-full mb-1 min-w-[500px]">
                  {monthLabels.map((label, i) => {
                    return (
                      <span 
                        key={`${label.month}-${i}`}
                        className="absolute text-[10px] text-muted-foreground hidden md:block"
                        style={{ left: `calc(${label.colIndex} * (14px + 4px))` }}
                      >
                        {label.month}
                      </span>
                    );
                  })}
                  {monthLabels.map((label, i) => {
                    return (
                      <span 
                        key={`mobile-${label.month}-${i}`}
                        className="absolute text-[10px] text-muted-foreground md:hidden"
                        style={{ left: `calc(${label.colIndex} * (12px + 3px))` }}
                      >
                        {label.month}
                      </span>
                    );
                  })}
                </div>

                {/* Grid */}
                <div className="flex gap-[3px] md:gap-[4px]">
                  {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-[3px] md:gap-[4px]">
                      {week.map((day, dayIndex) => (
                        <TooltipProvider key={day.date} delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div 
                                className={cn(
                                  "w-[12px] h-[12px] md:w-[14px] md:h-[14px] rounded-[2px] transition-colors cursor-pointer shrink-0",
                                  getLevelColor(day.level)
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent 
                              side="top" 
                              align="center"
                              sideOffset={6}
                              collisionPadding={8}
                              collisionBoundary={{ root: scrollRef }}
                              className="z-[99999] bg-popover text-popover-foreground shadow-md px-2 py-1 max-w-[150px] break-words"
                            >
                              <div className="text-center">
                                <p className="font-semibold text-xs">
                                  {day.durationMs === 0 
                                    ? "No reading" 
                                    : `${formatDuration(day.durationMs)} read`}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {formatDate(day.date)}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend - Fixed below the scrollable area */}
        <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-muted-foreground w-full">
          <span>Less</span>
          <div className="flex gap-[3px] md:gap-[4px]">
            <div className={cn("w-[12px] h-[12px] md:w-[14px] md:h-[14px] rounded-[2px]", getLevelColor(0))} />
            <div className={cn("w-[12px] h-[12px] md:w-[14px] md:h-[14px] rounded-[2px]", getLevelColor(1))} />
            <div className={cn("w-[12px] h-[12px] md:w-[14px] md:h-[14px] rounded-[2px]", getLevelColor(2))} />
            <div className={cn("w-[12px] h-[12px] md:w-[14px] md:h-[14px] rounded-[2px]", getLevelColor(3))} />
            <div className={cn("w-[12px] h-[12px] md:w-[14px] md:h-[14px] rounded-[2px]", getLevelColor(4))} />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
