import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CoverPageConfig } from "@shared/schema";

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
      <CardHeader>
        <CardTitle className="text-base">Cover Page</CardTitle>
        <CardDescription>Customize the cover page of your CMA presentation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="coverTitle">Title</Label>
          <Input
            id="coverTitle"
            value={config.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Comparative Market Analysis"
            data-testid="input-cover-title"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="coverSubtitle">Subtitle</Label>
          <Input
            id="coverSubtitle"
            value={config.subtitle}
            onChange={(e) => handleChange('subtitle', e.target.value)}
            placeholder="Prepared exclusively for you"
            data-testid="input-cover-subtitle"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="showDate">Show Date</Label>
          <Switch
            id="showDate"
            checked={config.showDate}
            onCheckedChange={(checked) => handleChange('showDate', checked)}
            data-testid="switch-show-date"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="showAgentPhoto">Show Agent Photo</Label>
          <Switch
            id="showAgentPhoto"
            checked={config.showAgentPhoto}
            onCheckedChange={(checked) => handleChange('showAgentPhoto', checked)}
            data-testid="switch-show-agent-photo"
          />
        </div>
        
        <div className="space-y-2">
          <Label>Background Style</Label>
          <RadioGroup
            value={config.background}
            onValueChange={(value) => handleChange('background', value as CoverPageConfig['background'])}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id="bg-none" data-testid="radio-bg-none" />
              <Label htmlFor="bg-none" className="font-normal">Plain White</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="gradient" id="bg-gradient" data-testid="radio-bg-gradient" />
              <Label htmlFor="bg-gradient" className="font-normal">Gradient</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="property" id="bg-property" data-testid="radio-bg-property" />
              <Label htmlFor="bg-property" className="font-normal">Property Photo</Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
