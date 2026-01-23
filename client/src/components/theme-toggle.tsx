import { Moon, Sun, Monitor, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTheme, ThemeMode } from "@/hooks/use-theme";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { mode, resolvedTheme, setTheme } = useTheme();

  const CurrentIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Toggle theme"
          data-testid="button-theme-toggle"
        >
          <CurrentIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = mode === option.value;
          
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className="cursor-pointer"
              data-testid={`theme-option-${option.value}`}
            >
              <Icon className="h-4 w-4 mr-2" />
              <span className="flex-1">{option.label}</span>
              {isSelected && <Check className="h-4 w-4 ml-2" />}
            </DropdownMenuItem>
          );
        })}
        
        {mode === "system" && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <p className="text-xs text-muted-foreground">
                Currently: {resolvedTheme === "dark" ? "Dark" : "Light"}
              </p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeToggleSimple() {
  const { toggleTheme, resolvedTheme } = useTheme();
  const Icon = resolvedTheme === "dark" ? Moon : Sun;
  
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleTheme}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      data-testid="button-theme-toggle-simple"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
