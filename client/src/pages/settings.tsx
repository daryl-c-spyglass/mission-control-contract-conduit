import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, UserPlus, Save, Mail, CheckCircle2, ExternalLink, User, Camera, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Coordinator } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteCoordinator, setDeleteCoordinator] = useState<Coordinator | null>(null);
  const [mySlackUserId, setMySlackUserId] = useState("");
  const [newCoordinator, setNewCoordinator] = useState({
    name: "",
    email: "",
    phone: "",
    slackUserId: "",
  });
  
  // Marketing profile state
  const [marketingProfile, setMarketingProfile] = useState({
    displayName: "",
    title: "",
    phone: "",
    email: "",
    headshotUrl: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    documentUploads: true,
    closingReminders: true,
    marketingAssets: true,
    reminder30Days: true,
    reminder14Days: true,
    reminder7Days: true,
    reminder3Days: true,
    reminder1Day: true,
    reminderDayOf: true,
  });

  useEffect(() => {
    if (user?.slackUserId) {
      setMySlackUserId(user.slackUserId);
    }
    // Load marketing profile from user
    if (user) {
      setMarketingProfile({
        displayName: user.marketingDisplayName || "",
        title: user.marketingTitle || "",
        phone: user.marketingPhone || "",
        email: user.marketingEmail || "",
        headshotUrl: user.marketingHeadshotUrl || "",
      });
    }
  }, [user]);

  const { data: coordinators = [], isLoading } = useQuery<Coordinator[]>({
    queryKey: ["/api/coordinators"],
  });

  // Notification settings query
  const { data: savedNotificationSettings } = useQuery<{
    documentUploads: boolean;
    closingReminders: boolean;
    marketingAssets: boolean;
    reminder30Days: boolean;
    reminder14Days: boolean;
    reminder7Days: boolean;
    reminder3Days: boolean;
    reminder1Day: boolean;
    reminderDayOf: boolean;
  }>({
    queryKey: ["/api/notification-settings"],
  });

  // Load notification settings when fetched
  useEffect(() => {
    if (savedNotificationSettings) {
      setNotificationSettings({
        documentUploads: savedNotificationSettings.documentUploads ?? true,
        closingReminders: savedNotificationSettings.closingReminders ?? true,
        marketingAssets: savedNotificationSettings.marketingAssets ?? true,
        reminder30Days: savedNotificationSettings.reminder30Days ?? true,
        reminder14Days: savedNotificationSettings.reminder14Days ?? true,
        reminder7Days: savedNotificationSettings.reminder7Days ?? true,
        reminder3Days: savedNotificationSettings.reminder3Days ?? true,
        reminder1Day: savedNotificationSettings.reminder1Day ?? true,
        reminderDayOf: savedNotificationSettings.reminderDayOf ?? true,
      });
    }
  }, [savedNotificationSettings]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { slackUserId: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your Slack User ID has been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const updateNotificationSettingsMutation = useMutation({
    mutationFn: async (data: typeof notificationSettings) => {
      const res = await apiRequest("PUT", "/api/notification-settings", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Settings saved", description: "Your notification preferences have been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-settings"] });
      // Update local state with server response to ensure consistency
      if (data) {
        setNotificationSettings({
          documentUploads: data.documentUploads ?? true,
          closingReminders: data.closingReminders ?? true,
          marketingAssets: data.marketingAssets ?? true,
          reminder30Days: data.reminder30Days ?? true,
          reminder14Days: data.reminder14Days ?? true,
          reminder7Days: data.reminder7Days ?? true,
          reminder3Days: data.reminder3Days ?? true,
          reminder1Day: data.reminder1Day ?? true,
          reminderDayOf: data.reminderDayOf ?? true,
        });
      }
    },
    onError: (error: Error, _variables, context: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update notification settings",
        variant: "destructive",
      });
      // Revert to previous settings on error
      if (context?.previousSettings) {
        setNotificationSettings(context.previousSettings);
      }
    },
    onMutate: async (newSettings) => {
      // Save current settings for rollback on error
      const previousSettings = { ...notificationSettings };
      setNotificationSettings(newSettings);
      return { previousSettings };
    },
  });

  const handleNotificationToggle = (key: keyof typeof notificationSettings, value: boolean) => {
    const newSettings = { ...notificationSettings, [key]: value };
    updateNotificationSettingsMutation.mutate(newSettings);
  };

  const addMutation = useMutation({
    mutationFn: async (data: typeof newCoordinator) => {
      const res = await apiRequest("POST", "/api/coordinators", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Coordinator added" });
      queryClient.invalidateQueries({ queryKey: ["/api/coordinators"] });
      setAddDialogOpen(false);
      setNewCoordinator({ name: "", email: "", phone: "", slackUserId: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add coordinator",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/coordinators/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Coordinator removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/coordinators"] });
      setDeleteCoordinator(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove coordinator",
        variant: "destructive",
      });
    },
  });

  const updateMarketingProfileMutation = useMutation({
    mutationFn: async (data: {
      marketingDisplayName?: string;
      marketingTitle?: string;
      marketingPhone?: string;
      marketingEmail?: string;
      marketingHeadshotUrl?: string;
    }) => {
      const res = await apiRequest("PATCH", "/api/user/graphics-settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Marketing profile saved", description: "Your agent info will appear on flyers and marketing materials." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save marketing profile",
        variant: "destructive",
      });
    },
  });

  const handleHeadshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setMarketingProfile(prev => ({ ...prev, headshotUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMarketingProfile = () => {
    updateMarketingProfileMutation.mutate({
      marketingDisplayName: marketingProfile.displayName || undefined,
      marketingTitle: marketingProfile.title || undefined,
      marketingPhone: marketingProfile.phone || undefined,
      marketingEmail: marketingProfile.email || undefined,
      marketingHeadshotUrl: marketingProfile.headshotUrl || undefined,
    });
  };

  const handleAddCoordinator = () => {
    if (!newCoordinator.name || !newCoordinator.email) {
      toast({
        title: "Required fields",
        description: "Please enter a name and email address",
        variant: "destructive",
      });
      return;
    }
    addMutation.mutate(newCoordinator);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your team and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Slack Settings</CardTitle>
          <CardDescription>
            Connect your Slack account to be automatically invited to transaction channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="mySlackId">Your Slack User ID</Label>
              <Input
                id="mySlackId"
                placeholder="U01234567"
                value={mySlackUserId}
                onChange={(e) => setMySlackUserId(e.target.value)}
                data-testid="input-my-slack-id"
              />
              <p className="text-xs text-muted-foreground">
                Find your ID: In Slack, click your profile, then "..." menu, then "Copy member ID"
              </p>
            </div>
            <Button
              onClick={() => updateProfileMutation.mutate({ slackUserId: mySlackUserId })}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-slack-id"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Agent Marketing Profile</CardTitle>
              <CardDescription>
                Your headshot and contact info will appear on flyers and marketing materials
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-start gap-6 flex-wrap">
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-32 w-32 border-4 border-muted">
                  {marketingProfile.headshotUrl ? (
                    <AvatarImage src={marketingProfile.headshotUrl} alt="Agent headshot" />
                  ) : null}
                  <AvatarFallback className="text-2xl">
                    <User className="h-12 w-12 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleHeadshotUpload}
                  data-testid="input-headshot-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                  data-testid="button-upload-headshot"
                >
                  <Camera className="h-4 w-4" />
                  {marketingProfile.headshotUrl ? "Change Photo" : "Upload Photo"}
                </Button>
              </div>
              
              <div className="flex-1 min-w-[280px] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="marketingDisplayName">Display Name</Label>
                    <Input
                      id="marketingDisplayName"
                      placeholder="John Smith"
                      value={marketingProfile.displayName}
                      onChange={(e) => setMarketingProfile(prev => ({ ...prev, displayName: e.target.value }))}
                      data-testid="input-marketing-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marketingTitle">Title</Label>
                    <Input
                      id="marketingTitle"
                      placeholder="REALTOR"
                      value={marketingProfile.title}
                      onChange={(e) => setMarketingProfile(prev => ({ ...prev, title: e.target.value }))}
                      data-testid="input-marketing-title"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="marketingPhone">Phone Number</Label>
                    <Input
                      id="marketingPhone"
                      type="tel"
                      placeholder="(512) 555-1234"
                      value={marketingProfile.phone}
                      onChange={(e) => setMarketingProfile(prev => ({ ...prev, phone: e.target.value }))}
                      data-testid="input-marketing-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marketingEmail">Email Address</Label>
                    <Input
                      id="marketingEmail"
                      type="email"
                      placeholder="john@spyglassrealty.com"
                      value={marketingProfile.email}
                      onChange={(e) => setMarketingProfile(prev => ({ ...prev, email: e.target.value }))}
                      data-testid="input-marketing-email"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button
                onClick={handleSaveMarketingProfile}
                disabled={updateMarketingProfileMutation.isPending}
                data-testid="button-save-marketing-profile"
              >
                {updateMarketingProfileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Marketing Profile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-500/10">
              <Mail className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <CardTitle>Gmail Integration</CardTitle>
              <CardDescription>
                Automatic email routing to Slack channels
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When you create a transaction, Mission Control automatically creates a Gmail filter for that property address. 
              Any emails containing the address will be labeled and forwarded to the Slack channel.
            </p>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Managed by your administrator</span>
            </div>
            <a 
              href="https://mail.google.com/mail/u/0/#settings/labels" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground flex items-center gap-1"
              data-testid="link-gmail-labels"
            >
              <ExternalLink className="h-3 w-3" />
              View your Gmail Labels
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/10">
              <Bell className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle>Slack Notifications</CardTitle>
              <CardDescription>
                Control what notifications are sent to transaction Slack channels
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Notification Types</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="documentUploads">Document Uploads</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications when documents are uploaded
                    </p>
                  </div>
                  <Switch
                    id="documentUploads"
                    checked={notificationSettings.documentUploads}
                    onCheckedChange={(checked) => handleNotificationToggle('documentUploads', checked)}
                    data-testid="switch-document-uploads"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="closingReminders">Closing Date Reminders</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive reminders as the closing date approaches
                    </p>
                  </div>
                  <Switch
                    id="closingReminders"
                    checked={notificationSettings.closingReminders}
                    onCheckedChange={(checked) => handleNotificationToggle('closingReminders', checked)}
                    data-testid="switch-closing-reminders"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="marketingAssets">Marketing Assets</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications when marketing materials are created
                    </p>
                  </div>
                  <Switch
                    id="marketingAssets"
                    checked={notificationSettings.marketingAssets}
                    onCheckedChange={(checked) => handleNotificationToggle('marketingAssets', checked)}
                    data-testid="switch-marketing-assets"
                  />
                </div>
              </div>
            </div>

            {notificationSettings.closingReminders && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-medium">Reminder Schedule</h4>
                <p className="text-xs text-muted-foreground">
                  Choose which closing date reminders to receive
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="reminder30Days" className="text-sm">30 days before</Label>
                    <Switch
                      id="reminder30Days"
                      checked={notificationSettings.reminder30Days}
                      onCheckedChange={(checked) => handleNotificationToggle('reminder30Days', checked)}
                      data-testid="switch-reminder-30"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="reminder14Days" className="text-sm">14 days before</Label>
                    <Switch
                      id="reminder14Days"
                      checked={notificationSettings.reminder14Days}
                      onCheckedChange={(checked) => handleNotificationToggle('reminder14Days', checked)}
                      data-testid="switch-reminder-14"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="reminder7Days" className="text-sm">7 days before</Label>
                    <Switch
                      id="reminder7Days"
                      checked={notificationSettings.reminder7Days}
                      onCheckedChange={(checked) => handleNotificationToggle('reminder7Days', checked)}
                      data-testid="switch-reminder-7"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="reminder3Days" className="text-sm">3 days before</Label>
                    <Switch
                      id="reminder3Days"
                      checked={notificationSettings.reminder3Days}
                      onCheckedChange={(checked) => handleNotificationToggle('reminder3Days', checked)}
                      data-testid="switch-reminder-3"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="reminder1Day" className="text-sm">1 day before</Label>
                    <Switch
                      id="reminder1Day"
                      checked={notificationSettings.reminder1Day}
                      onCheckedChange={(checked) => handleNotificationToggle('reminder1Day', checked)}
                      data-testid="switch-reminder-1"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="reminderDayOf" className="text-sm">Day of closing</Label>
                    <Switch
                      id="reminderDayOf"
                      checked={notificationSettings.reminderDayOf}
                      onCheckedChange={(checked) => handleNotificationToggle('reminderDayOf', checked)}
                      data-testid="switch-reminder-day-of"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Transaction Coordinators</CardTitle>
              <CardDescription>
                Add team members who help manage transactions
              </CardDescription>
            </div>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="gap-2"
              data-testid="button-add-coordinator"
            >
              <UserPlus className="h-4 w-4" />
              Add Coordinator
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-md bg-muted/30 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-48 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : coordinators.length > 0 ? (
            <div className="space-y-3">
              {coordinators.map((coordinator) => (
                <div
                  key={coordinator.id}
                  className="flex items-center gap-4 p-3 rounded-md bg-muted/30"
                  data-testid={`row-coordinator-${coordinator.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {coordinator.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{coordinator.name}</p>
                      {coordinator.slackUserId && (
                        <Badge variant="outline" className="text-xs">Slack connected</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {coordinator.email}
                      {coordinator.phone && ` • ${coordinator.phone}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteCoordinator(coordinator)}
                    data-testid={`button-delete-coordinator-${coordinator.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No coordinators added yet</p>
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add your first coordinator
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction Coordinator</DialogTitle>
            <DialogDescription>
              Add a team member to help manage transactions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Jane Smith"
                value={newCoordinator.name}
                onChange={(e) => setNewCoordinator((prev) => ({ ...prev, name: e.target.value }))}
                data-testid="input-coordinator-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@realty.com"
                value={newCoordinator.email}
                onChange={(e) => setNewCoordinator((prev) => ({ ...prev, email: e.target.value }))}
                data-testid="input-coordinator-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={newCoordinator.phone}
                onChange={(e) => setNewCoordinator((prev) => ({ ...prev, phone: e.target.value }))}
                data-testid="input-coordinator-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slackUserId">Slack User ID (optional)</Label>
              <Input
                id="slackUserId"
                placeholder="U01234567"
                value={newCoordinator.slackUserId}
                onChange={(e) => setNewCoordinator((prev) => ({ ...prev, slackUserId: e.target.value }))}
                data-testid="input-coordinator-slack"
              />
              <p className="text-xs text-muted-foreground">
                Used to automatically invite them to transaction channels
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCoordinator}
                disabled={addMutation.isPending}
                data-testid="button-submit-coordinator"
              >
                {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Coordinator
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCoordinator} onOpenChange={() => setDeleteCoordinator(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Coordinator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteCoordinator?.name}? They will no longer be available to assign to new transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCoordinator && deleteMutation.mutate(deleteCoordinator.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
