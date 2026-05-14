import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ManageLibrary } from "./ManageLibrary";
import { Library } from "lucide-react";

interface ManageLibraryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageLibraryDialog({ isOpen, onOpenChange }: ManageLibraryDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-row items-center justify-between pr-9">
          <DialogTitle className="flex items-center gap-2">
            <Library className="w-5 h-5 text-primary" />
            Manage Library
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 flex-1 overflow-y-auto">
          <ManageLibrary />
        </div>
      </DialogContent>
    </Dialog>
  );
}