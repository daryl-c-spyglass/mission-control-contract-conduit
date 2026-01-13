import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Sparkles, 
  X, 
  Plus, 
  Image as ImageIcon, 
  Type, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Link as LinkIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImageSearchItem {
  type: 'text' | 'image';
  value?: string;
  url?: string;
  boost?: number;
}

export interface VisualMatchCriteria {
  imageSearchItems: ImageSearchItem[];
  standardStatus?: string;
  status?: string;
  type?: string;
  city?: string;
  subdivision?: string;
  postalCode?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  class?: string;
  propertyType?: string;
  resultsPerPage?: number;
  pageNum?: number;
}

interface VisualMatchPanelProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  items: ImageSearchItem[];
  onItemsChange: (items: ImageSearchItem[]) => void;
  isSearching?: boolean;
  onSearch?: () => void;
  compact?: boolean;
  className?: string;
  demoMode?: boolean;
  error?: string;
}

const PRESET_CHIPS = [
  { label: "Modern Kitchen", value: "modern kitchen with granite countertops" },
  { label: "Open Floor Plan", value: "open floor plan living area" },
  { label: "Pool & Backyard", value: "swimming pool with landscaped backyard" },
  { label: "Natural Light", value: "large windows with natural light" },
  { label: "Hardwood Floors", value: "hardwood floors throughout" },
  { label: "Updated Bathroom", value: "updated bathroom with modern fixtures" },
  { label: "High Ceilings", value: "high vaulted ceilings" },
  { label: "Outdoor Living", value: "covered patio outdoor living space" },
];

export default function VisualMatchPanel({
  enabled,
  onEnabledChange,
  items,
  onItemsChange,
  isSearching = false,
  onSearch,
  compact = false,
  className,
  demoMode = false,
  error = ''
}: VisualMatchPanelProps) {
  const [showImageUrl, setShowImageUrl] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [customText, setCustomText] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTextItem = (text: string) => {
    if (!text.trim()) return;
    if (items.length >= 10) return;
    const newItem: ImageSearchItem = { type: 'text', value: text.trim() };
    onItemsChange([...items, newItem]);
    setCustomText("");
  };

  const addImageItem = (url: string) => {
    if (!url.trim()) return;
    if (items.length >= 10) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return;
    }
    const newItem: ImageSearchItem = { type: 'image', url: url.trim() };
    onItemsChange([...items, newItem]);
    setImageUrl("");
    setShowImageUrl(false);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems);
  };

  const updateItemBoost = (index: number, boost: number) => {
    const newItems = items.map((item, i) => 
      i === index ? { ...item, boost } : item
    );
    onItemsChange(newItems);
  };

  const clearAll = () => {
    onItemsChange([]);
    setImageUrl("");
    setCustomText("");
    setShowImageUrl(false);
  };

  if (!enabled) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <Label className="text-base font-semibold">Visual Match</Label>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            data-testid="switch-visual-match"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Rank results by visual similarity to photos or descriptions
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <Label className="text-base font-semibold">Visual Match</Label>
          {demoMode && (
            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
              Demo
            </Badge>
          )}
          {items.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {items.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-6 px-2 text-xs text-muted-foreground"
              data-testid="button-clear-visual-match"
            >
              Clear
            </Button>
          )}
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            data-testid="switch-visual-match"
          />
        </div>
      </div>

      {/* Error/Demo Mode Message */}
      {error && (
        <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-md p-2">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {items.map((item, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="pl-2 pr-1 py-1 flex items-center gap-1 max-w-full"
                data-testid={`badge-visual-item-${index}`}
              >
                {item.type === 'image' ? (
                  <ImageIcon className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <Type className="w-3 h-3 flex-shrink-0" />
                )}
                <span className="truncate max-w-[150px] text-xs">
                  {item.type === 'image' ? 'Image URL' : item.value}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                  data-testid={`button-remove-item-${index}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {!compact && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick Add</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CHIPS.map((preset, index) => {
                  const isAdded = items.some(
                    item => item.type === 'text' && item.value === preset.value
                  );
                  return (
                    <Button
                      key={index}
                      type="button"
                      variant={isAdded ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (isAdded) {
                          const newItems = items.filter(
                            item => !(item.type === 'text' && item.value === preset.value)
                          );
                          onItemsChange(newItems);
                        } else {
                          addTextItem(preset.value);
                        }
                      }}
                      disabled={items.length >= 10 && !isAdded}
                      className={cn(
                        "h-7 text-xs",
                        isAdded && "toggle-elevate toggle-elevated"
                      )}
                      data-testid={`button-preset-${index}`}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Custom Description</Label>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  placeholder="e.g., Chef's kitchen, spa bathroom..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTextItem(customText);
                    }
                  }}
                  disabled={items.length >= 10}
                  className="h-8 text-sm"
                  data-testid="input-custom-text"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => addTextItem(customText)}
                  disabled={!customText.trim() || items.length >= 10}
                  className="h-8"
                  data-testid="button-add-text"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Reference Image</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowImageUrl(!showImageUrl)}
                  className="h-6 px-2 text-xs"
                  data-testid="button-toggle-image-url"
                >
                  <LinkIcon className="w-3 h-3 mr-1" />
                  {showImageUrl ? 'Hide' : 'Add URL'}
                </Button>
              </div>
              
              {showImageUrl && (
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addImageItem(imageUrl);
                      }
                    }}
                    disabled={items.length >= 10}
                    className="h-8 text-sm"
                    data-testid="input-image-url"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => addImageItem(imageUrl)}
                    disabled={!imageUrl.trim() || items.length >= 10 || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))}
                    className="h-8"
                    data-testid="button-add-image"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {items.length >= 10 && (
          <p className="text-xs text-muted-foreground">
            Maximum 10 items reached
          </p>
        )}

        {onSearch && items.length > 0 && (
          <Button
            onClick={onSearch}
            disabled={isSearching || items.length === 0}
            className="w-full"
            data-testid="button-visual-search"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Search by Visual Match
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
