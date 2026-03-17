import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SimpleToastProps {
  message: string;
  type?: 'success' | 'error';
  duration?: number;
  onClose: () => void;
}

export function SimpleToast({ message, type = 'success', duration = 4000, onClose }: SimpleToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setIsVisible(true);
    
    // Auto close
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Use theme-aware colors via CSS custom properties
  const toastClasses = type === 'success' 
    ? 'bg-primary text-primary-foreground' 
    : 'bg-destructive text-destructive-foreground';

  return (
    <div
      className={`fixed bottom-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      } ${toastClasses}`}
    >
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Toast manager
let toastId = 0;
const toasts: Array<{ id: number; props: Omit<SimpleToastProps, 'onClose'> }> = [];

export const toast = {
  success: (message: string, options?: { duration?: number }) => {
    const id = ++toastId;
    const props = { message, type: 'success' as const, duration: options?.duration };
    toasts.push({ id, props });
    updateToasts();
    return id;
  },
  error: (message: string, options?: { duration?: number }) => {
    const id = ++toastId;
    const props = { message, type: 'error' as const, duration: options?.duration };
    toasts.push({ id, props });
    updateToasts();
    return id;
  },
};

let updateToasts: () => void = () => {};

export function ToastContainer() {
  const [currentToasts, setCurrentToasts] = useState(toasts);

  updateToasts = () => {
    setCurrentToasts([...toasts]);
  };

  const handleClose = (id: number) => {
    const index = toasts.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.splice(index, 1);
      updateToasts();
    }
  };

  return (
    <div className="fixed bottom-0 right-0 z-[9999] p-4 space-y-2 pointer-events-none">
      {currentToasts.map(({ id, props }) => (
        <div key={id} className="pointer-events-auto">
          <SimpleToast {...props} onClose={() => handleClose(id)} />
        </div>
      ))}
    </div>
  );
}
