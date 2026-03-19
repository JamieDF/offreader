import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  List,
  Info,
  ScrollText,
} from "lucide-react";
import { SharedSettings } from "./SharedSettings";
import { useReaderSettings } from "@/hooks/useReaderSettings";
import { useNavigate } from "react-router-dom";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookId?: string;
  onOpenToc?: () => void;
}

const SettingsDrawer = ({ isOpen, onClose, bookId, onOpenToc }: SettingsDrawerProps) => {
  const navigate = useNavigate();
  const { settings, updateSettings } = useReaderSettings();

  const handleGoToDetails = () => {
    if (bookId) {
      navigate(`/book/${bookId}`);
    }
    onClose();
  };

  const handleOpenToc = () => {
    onOpenToc?.();
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-center">Reading Settings</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto">
          <SharedSettings settings={settings} updateSettings={updateSettings} />

          <Separator className="my-6" />

          {/* Section 2: Layout & Navigation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ScrollText className="h-4 w-4" />
              <span>Layout & Navigation</span>
            </div>

            {/* Table of Contents */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleOpenToc}
            >
              <List className="h-4 w-4" />
              <span>Table of Contents</span>
            </Button>

            {/* Book Details */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleGoToDetails}
            >
              <Info className="h-4 w-4" />
              <span>Book Details</span>
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default SettingsDrawer;
