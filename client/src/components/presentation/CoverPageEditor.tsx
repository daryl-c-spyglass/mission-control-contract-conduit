import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import type { CoverPageConfig } from "@shared/schema";
import { cn } from "@/lib/utils";

interface CoverPageEditorProps {
  config: CoverPageConfig;
  onChange: (config: CoverPageConfig) => void;
}

export function CoverPageEditor({ config, onChange }: CoverPageEditorProps) {
  const handleChange = (key: keyof CoverPageConfig, value: string | boolean) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Cover Page</CardTitle>
        <CardDescription>Customize the title and appearance of your cover page</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h4 className="font-semibold text-sm">Cover Page</h4>
          <p className="text-xs text-muted-foreground">Customize how your CMA cover page appears</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="coverTitle" className="text-sm">Title</Label>
          <Input
            id="coverTitle"
            value={config.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Comparative Market Analysis"
            data-testid="input-cover-title"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="coverSubtitle" className="text-sm">Subtitle</Label>
          <Input
            id="coverSubtitle"
            value={config.subtitle}
            onChange={(e) => handleChange('subtitle', e.target.value)}
            placeholder="Prepared exclusively for you"
            data-testid="input-cover-subtitle"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="showDate" className="font-medium text-sm">Show Date</Label>
            <p className="text-xs text-muted-foreground">Display report date on cover</p>
          </div>
          <Switch
            id="showDate"
            checked={config.showDate}
            onCheckedChange={(checked) => handleChange('showDate', checked)}
            data-testid="switch-show-date"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="showAgentPhoto" className="font-medium text-sm">Show Agent Photo</Label>
            <p className="text-xs text-muted-foreground">Include your photo on cover</p>
          </div>
          <Switch
            id="showAgentPhoto"
            checked={config.showAgentPhoto}
            onCheckedChange={(checked) => handleChange('showAgentPhoto', checked)}
            data-testid="switch-show-agent-photo"
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-sm">Cover Background</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={config.background === 'none' ? 'default' : 'outline'}
              onClick={() => handleChange('background', 'none')}
              className={cn(
                "flex-1 gap-2",
                config.background === 'none' && "bg-orange-500 hover:bg-orange-600"
              )}
              data-testid="button-bg-white"
            >
              Plain White
              {config.background === 'none' && <Check className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant={config.background === 'gradient' ? 'default' : 'outline'}
              onClick={() => handleChange('background', 'gradient')}
              className={cn(
                "flex-1 gap-2",
                config.background === 'gradient' && "bg-orange-500 hover:bg-orange-600"
              )}
              data-testid="button-bg-gradient"
            >
              Gradient
              {config.background === 'gradient' && <Check className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant={config.background === 'property' ? 'default' : 'outline'}
              onClick={() => handleChange('background', 'property')}
              className={cn(
                "flex-1 gap-2",
                config.background === 'property' && "bg-orange-500 hover:bg-orange-600"
              )}
              data-testid="button-bg-property"
            >
              Property Photo
              {config.background === 'property' && <Check className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Preview:</Label>
          <div className="border rounded-lg p-4 bg-gradient-to-b from-white to-muted/30">
            <div className="text-center space-y-2">
              <p className="text-xs text-orange-500 font-medium">Spyglass Realty</p>
              <p className="text-base font-bold">{config.title || 'Comparative Market Analysis'}</p>
              <p className="text-xs text-muted-foreground">{config.subtitle || 'Prepared exclusively for you'}</p>
              {config.showDate && (
                <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</p>
              )}
              {config.showAgentPhoto && (
                <div className="flex justify-center mt-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    D
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
