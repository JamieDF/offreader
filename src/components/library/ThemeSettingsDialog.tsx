import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SharedSettings } from "../reader/SharedSettings";
import { useReaderSettings } from "@/hooks/useReaderSettings";
import { Settings2 } from "lucide-react";

interface ThemeSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemeSettingsDialog({ isOpen, onOpenChange }: ThemeSettingsDialogProps) {
  const { settings, updateSettings } = useReaderSettings();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-row items-center justify-between pr-9">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Appearance & Reading
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 flex-1 overflow-y-auto">
          <SharedSettings settings={settings} updateSettings={updateSettings} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
