import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storageService } from '@/services/storage';
import { FONT_FAMILY_MAP } from '@/utils/readerStyles';

export type ThemeOption = "day" | "parchment" | "meadow" | "coast" | "night" | "neon" | "noir" | "storm";
export type FontFamily = "Georgia" | "Playfair Display" | "JetBrains Mono" | "Fira Code" | "Uncial Antiqua" | "Special Elite" | "Lato" | "Montserrat" | "Source Sans Pro";

interface ReaderSettings {
  fontSize: number;
  selectedTheme: ThemeOption;
  fontFamily: FontFamily;
  lineHeight: number;
  marginWidth: number;
  paragraphSpacing: number;
  useReaderFontForSystem: boolean;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 100,
  selectedTheme: "parchment",
  fontFamily: "Montserrat",
  lineHeight: 1.2,
  marginWidth: 0,
  paragraphSpacing: 1.0,
  useReaderFontForSystem: true,
};

const SETTINGS_KEY = "reader-settings";

interface ReaderSettingsContextType {
  settings: ReaderSettings;
  updateSettings: (updates: Partial<ReaderSettings>) => void;
  isLoaded: boolean;
}

const ReaderSettingsContext = createContext<ReaderSettingsContextType | undefined>(undefined);

export function ReaderSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await storageService.getItem(SETTINGS_KEY);
        const parsed = saved ? JSON.parse(saved) : {};
        const finalSettings = { ...DEFAULT_SETTINGS, ...parsed };
        setSettings(finalSettings);
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load reader settings:', error);
        setSettings(DEFAULT_SETTINGS);
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    // Don't save on initial mount before loading
    if (!isLoaded) return;

    // Save settings to storage
    storageService.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(error => {
      console.error('Failed to save reader settings:', error);
    });
    
    // Apply theme class to document
    document.documentElement.classList.remove("theme-day", "theme-parchment", "theme-meadow", "theme-coast", "theme-night", "theme-neon", "theme-noir", "theme-storm", "dark");
    
    const themeClass = `theme-${settings.selectedTheme}`;
    document.documentElement.classList.add(themeClass);
    
    if (settings.selectedTheme === "night" || settings.selectedTheme === "neon" || settings.selectedTheme === "noir" || settings.selectedTheme === "storm") {
      document.documentElement.classList.add("dark");
    }
    
    // Update body background/color to match theme immediately
    const computedStyle = getComputedStyle(document.documentElement);
    document.body.style.backgroundColor = `hsl(${computedStyle.getPropertyValue('--background')})`;
    document.body.style.color = `hsl(${computedStyle.getPropertyValue('--foreground')})`;
    
    // Apply typography settings to CSS custom properties
    document.documentElement.style.setProperty('--reader-font-size', `${settings.fontSize}%`);
    document.documentElement.style.setProperty('--reader-line-height', settings.lineHeight.toString());
    document.documentElement.style.setProperty('--reader-margin-width', `${settings.marginWidth}%`);
    document.documentElement.style.setProperty('--reader-paragraph-spacing', `${settings.paragraphSpacing}em`);
    document.documentElement.style.setProperty('--reader-font-family', settings.fontFamily);
    
    // Apply reader font to system UI if enabled
    if (settings.useReaderFontForSystem) {
      document.body.style.fontFamily = FONT_FAMILY_MAP[settings.fontFamily] ?? FONT_FAMILY_MAP['Georgia'];
    } else {
      document.body.style.fontFamily = 'Roboto, "Helvetica Neue", Arial, sans-serif';
    }
    
    // Dispatch event for sync
    window.dispatchEvent(new Event("reader-settings-updated"));
  }, [settings, isLoaded]);

  const updateSettings = (updates: Partial<ReaderSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <ReaderSettingsContext.Provider value={{ settings, updateSettings, isLoaded }}>
      {children}
    </ReaderSettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReaderSettings() {
  const context = useContext(ReaderSettingsContext);
  if (context === undefined) {
    throw new Error('useReaderSettings must be used within a ReaderSettingsProvider');
  }
  return context;
}
