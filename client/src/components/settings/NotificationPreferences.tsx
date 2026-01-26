import { useState, useEffect } from "react";
import { Bell, FileText, Calendar, Image, User, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface NotificationPrefs {
  notifyDocumentUploads: boolean;
  notifyClosingReminders: boolean;
  notifyMarketingAssets: boolean;
}

export function NotificationPreferences() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    notifyDocumentUploads: false,
    notifyClosingReminders: false,
    notifyMarketingAssets: false,
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await fetch("/api/user/notification-preferences");
      if (res.ok) {
        const data = await res.json();
        setPrefs({
          notifyDocumentUploads: data.notifyDocumentUploads ?? false,
          notifyClosingReminders: data.notifyClosingReminders ?? false,
          notifyMarketingAssets: data.notifyMarketingAssets ?? false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPrefs, value: boolean) => {
    const previousPrefs = { ...prefs };
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    setSaving(true);
    
    try {
      const res = await fetch("/api/user/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to save");
      }
      
      toast({
        title: "Preferences saved",
        description: "Your notification settings have been updated.",
      });
    } catch (error) {
      setPrefs(previousPrefs);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-12 bg-muted rounded"></div>
            <div className="h-12 bg-muted rounded"></div>
            <div className="h-12 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const notificationOptions = [
    {
      key: "notifyDocumentUploads" as const,
      icon: FileText,
      title: "Document Uploads",
      description: "Receive notifications when documents are uploaded",
    },
    {
      key: "notifyClosingReminders" as const,
      icon: Calendar,
      title: "Closing Date Reminders",
      description: "Receive reminders as the closing date approaches",
    },
    {
      key: "notifyMarketingAssets" as const,
      icon: Image,
      title: "Marketing Assets",
      description: "Receive notifications when marketing materials are created",
    },
  ];

  const activeCount = Object.values(prefs).filter(Boolean).length;

  return (
    <Card data-testid="notification-preferences-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#EF4923]/10 rounded-lg">
            <Bell className="h-5 w-5 text-[#EF4923]" />
          </div>
          <div>
            <CardTitle>Slack Notifications</CardTitle>
            <CardDescription>
              Control what notifications are sent to transaction Slack channels
            </CardDescription>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2">
          <User className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-blue-400">
            These are your personal notification preferences. Other team members have their own settings.
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">
          Notification Types
        </p>
        
        {notificationOptions.map((option) => (
          <div
            key={option.key}
            className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
            data-testid={`notification-option-${option.key}`}
          >
            <div className="flex items-center gap-3">
              <option.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="font-medium cursor-pointer">
                  {option.title}
                </Label>
                <p className="text-sm text-muted-foreground mt-0.5">{option.description}</p>
              </div>
            </div>
            <Switch
              checked={prefs[option.key]}
              onCheckedChange={(checked) => updatePreference(option.key, checked)}
              disabled={saving}
              className="data-[state=checked]:bg-[#EF4923]"
              data-testid={`switch-${option.key}`}
            />
          </div>
        ))}

        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="w-4 h-4 text-green-500" />
            <span>Changes saved automatically to your account</span>
          </div>
        </div>

        {activeCount > 0 && (
          <div className="p-4 bg-muted/20 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              <span className="font-medium">Your Active Notifications:</span>
            </p>
            <div className="space-y-1">
              {prefs.notifyDocumentUploads && (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <Check className="w-3 h-3" />
                  Document Upload notifications
                </div>
              )}
              {prefs.notifyClosingReminders && (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <Check className="w-3 h-3" />
                  Closing Date Reminder notifications
                </div>
              )}
              {prefs.notifyMarketingAssets && (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <Check className="w-3 h-3" />
                  Marketing Asset notifications
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
