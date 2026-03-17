import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, CheckCircle } from "lucide-react";

interface BookActionsProps {
  isFinished: boolean;
  onMarkFinished: (finished: boolean) => void;
  onRemove: () => void;
}

export function BookActions({
  isFinished,
  onMarkFinished,
  onRemove,
}: BookActionsProps) {
  return (
    <div className="px-4 md:px-6 mt-6 mb-8 space-y-4">
      {/* Mark as Finished toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-primary" />
          <Label htmlFor="finished-toggle" className="text-sm font-medium cursor-pointer">
            Mark as Finished
          </Label>
        </div>
        <Switch
          id="finished-toggle"
          checked={isFinished}
          onCheckedChange={onMarkFinished}
        />
      </div>

      {/* Remove from device */}
      <Button
        variant="outline"
        className="w-full border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        onClick={onRemove}
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Remove from Device
      </Button>
    </div>
  );
}
