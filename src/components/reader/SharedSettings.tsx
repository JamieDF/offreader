import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Type, Minus, Plus, Sun, Monitor } from "lucide-react";
import { ThemeOption, FontFamily } from "@/contexts/ReaderSettingsContext";

export const themeOptions: { id: ThemeOption; label: string; bg: string; text: string; border: string }[] = [
  // Light Themes
  { id: "day", label: "Day", bg: "bg-white", text: "text-black", border: "border-gray-300" },
  { id: "parchment", label: "Parchment", bg: "bg-amber-100", text: "text-amber-900", border: "border-amber-400" },
  { id: "meadow", label: "Meadow", bg: "bg-green-100", text: "text-green-900", border: "border-green-300" },
  { id: "coast", label: "Coast", bg: "bg-sky-100", text: "text-sky-900", border: "border-sky-300" },
  
  // Dark Themes
  { id: "night", label: "Night", bg: "bg-black", text: "text-white", border: "border-zinc-700" },
  { id: "neon", label: "Neon", bg: "bg-purple-950", text: "text-cyan-400", border: "border-pink-500" },
  { id: "noir", label: "Noir", bg: "bg-neutral-900", text: "text-amber-200", border: "border-amber-600" },
  { id: "storm", label: "Storm", bg: "bg-slate-900", text: "text-blue-300", border: "border-blue-800" },
];

interface SharedSettingsProps {
  settings: {
    fontSize: number;
    selectedTheme: ThemeOption;
    fontFamily: FontFamily;
    lineHeight: number;
    marginWidth: number;
    paragraphSpacing: number;
    useReaderFontForSystem: boolean;
  };
  updateSettings: (updates: any) => void;
}

export function SharedSettings({ settings, updateSettings }: SharedSettingsProps) {
  const handleFontSizeChange = (delta: number) => {
    updateSettings({ fontSize: Math.max(50, Math.min(200, settings.fontSize + delta)) });
  };

  return (
    <div className="space-y-6">
      {/* Typography */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Type className="h-4 w-4" />
          <span>Typography</span>
        </div>

        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
          <span className="text-sm">Font Size</span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFontSizeChange(-10)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-12 text-center">{settings.fontSize}%</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFontSizeChange(10)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
          <span className="text-sm">Font Family</span>
          <Select 
            value={settings.fontFamily} 
            onValueChange={(v) => updateSettings({ fontFamily: v as FontFamily })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Serif Fonts */}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">Serif</div>
              <SelectItem value="Georgia">Georgia</SelectItem>
              <SelectItem value="Playfair Display">Playfair Display</SelectItem>
              <SelectItem value="Uncial Antiqua">Uncial Antiqua</SelectItem>
              
              {/* Sans-serif Fonts */}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">Sans-serif</div>
              <SelectItem value="Lato">Lato</SelectItem>
              <SelectItem value="Montserrat">Montserrat</SelectItem>
              <SelectItem value="Source Sans Pro">Source Sans Pro</SelectItem>
              
              {/* Monospace Fonts */}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">Monospace</div>
              <SelectItem value="JetBrains Mono">JetBrains Mono</SelectItem>
              <SelectItem value="Fira Code">Syne Mono</SelectItem>
              <SelectItem value="Special Elite">Special Elite</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
          <span className="text-sm">Use Reader Font for App UI</span>
          <Switch
            checked={settings.useReaderFontForSystem}
            onCheckedChange={(checked) => updateSettings({ useReaderFontForSystem: checked })}
          />
        </div>

        <div className="space-y-2 bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Line Height</span>
            <span className="text-sm font-medium">{settings.lineHeight.toFixed(1)}</span>
          </div>
          <Slider
            value={[settings.lineHeight]}
            onValueChange={([value]) => updateSettings({ lineHeight: value })}
            min={1.2}
            max={2.0}
            step={0.1}
            className="w-full"
          />
        </div>

        <div className="space-y-2 bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Margin Width</span>
            <span className="text-sm font-medium">{settings.marginWidth}%</span>
          </div>
          <Slider
            value={[settings.marginWidth]}
            onValueChange={([value]) => updateSettings({ marginWidth: value })}
            min={0}
            max={30}
            step={5}
            className="w-full"
          />
        </div>

        <div className="space-y-2 bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Paragraph Spacing</span>
            <span className="text-sm font-medium">{settings.paragraphSpacing.toFixed(1)}</span>
          </div>
          <Slider
            value={[settings.paragraphSpacing]}
            onValueChange={([value]) => updateSettings({ paragraphSpacing: value })}
            min={0.5}
            max={2.0}
            step={0.1}
            className="w-full"
          />
        </div>
      </div>

      {/* Theme */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Monitor className="h-4 w-4" />
          <span>Theme</span>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 space-y-4">
          {/* Light Themes */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Light Themes</div>
            <div className="grid grid-cols-2 gap-2">
              {themeOptions.slice(0, 4).map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => updateSettings({ selectedTheme: theme.id })}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 ${theme.bg} ${theme.border} transition-all ${
                    settings.selectedTheme === theme.id 
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                      : ""
                  }`}
                  title={theme.label}
                >
                  <span className={`text-sm font-bold ${theme.text}`}>
                    {theme.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Dark Themes */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dark Themes</div>
            <div className="grid grid-cols-2 gap-2">
              {themeOptions.slice(4).map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => updateSettings({ selectedTheme: theme.id })}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 ${theme.bg} ${theme.border} transition-all ${
                    settings.selectedTheme === theme.id 
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                      : ""
                  }`}
                  title={theme.label}
                >
                  <span className={`text-sm font-bold ${theme.text}`}>
                    {theme.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
