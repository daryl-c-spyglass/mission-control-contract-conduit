import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Upload, Save, User, Phone, Briefcase, Camera } from "lucide-react";

export default function GraphicsSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.marketingDisplayName || "");
  const [title, setTitle] = useState(user?.marketingTitle || "");
  const [phone, setPhone] = useState(user?.marketingPhone || "");
  const [headshotUrl, setHeadshotUrl] = useState(user?.marketingHeadshotUrl || "");
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (data: {
      marketingHeadshotUrl: string | null;
      marketingDisplayName: string | null;
      marketingTitle: string | null;
      marketingPhone: string | null;
    }) => {
      const response = await fetch("/api/user/graphics-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to save");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Settings Saved",
        description: "Your marketing graphics settings have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image under 5MB.",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setHeadshotPreview(dataUrl);
        setHeadshotUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    saveMutation.mutate({
      marketingHeadshotUrl: headshotUrl || null,
      marketingDisplayName: displayName || null,
      marketingTitle: title || null,
      marketingPhone: phone || null,
    });
  };

  const getInitials = () => {
    if (displayName) {
      return displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return "AG";
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Graphics Settings</h1>
        <p className="text-muted-foreground">
          Configure your marketing materials appearance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Agent Profile for Marketing
          </CardTitle>
          <CardDescription>
            This information will appear on your property flyers, social media graphics, and other marketing materials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage src={headshotPreview || headshotUrl || undefined} />
                <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-headshot"
              >
                <Upload className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-headshot-file"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Professional Headshot</p>
              <p className="text-xs text-muted-foreground">
                Upload a high-quality headshot photo. This will appear on all your marketing materials.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Display Name
              </Label>
              <Input
                id="displayName"
                placeholder="e.g., Shannon Gilmore, REALTOR®, GRI, CNE"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                data-testid="input-display-name"
              />
              <p className="text-xs text-muted-foreground">
                Include your name and any professional designations
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Title
              </Label>
              <Input
                id="title"
                placeholder="e.g., REALTOR®, GRI, CNE"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
              </Label>
              <Input
                id="phone"
                placeholder="(737) 252-4420"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-save-graphics"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            How your information will appear on marketing materials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-md p-4 flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-white shadow-md">
              <AvatarImage src={headshotPreview || headshotUrl || undefined} />
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold" data-testid="preview-name">
                {displayName || "Your Name Here"}
              </p>
              {title && <p className="text-sm text-muted-foreground">{title}</p>}
              <p className="text-sm" data-testid="preview-phone">
                {phone || "(xxx) xxx-xxxx"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
