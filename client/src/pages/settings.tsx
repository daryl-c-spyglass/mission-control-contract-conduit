import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, UserPlus, Save, Mail, CheckCircle2, ExternalLink, User, Camera, Bell, FileText, Sparkles, Link as LinkIcon, Upload, GripVertical, Pencil, FolderOpen, QrCode, Building2, Image as ImageIcon } from "lucide-react";
import { SiFacebook, SiInstagram, SiLinkedin, SiX } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import type { AgentProfile, AgentResource } from "@shared/schema";
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
import { NotificationPreferences } from "@/components/settings/NotificationPreferences";

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
    firstName: "",
    lastName: "",
    email: "", // Read-only from OAuth
    phone: "",
    title: "",
    company: "Spyglass Realty",
    headshotUrl: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phone number formatting helper (XXX-XXX-XXXX format)
  const formatPhoneNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    } else {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setMarketingProfile(prev => ({ ...prev, phone: formatted }));
  };

  // Agent profile state (Bio, Cover Letter, Social Links)
  const [agentProfile, setAgentProfile] = useState({
    bio: "",
    defaultCoverLetter: "",
    facebookUrl: "",
    instagramUrl: "",
    linkedinUrl: "",
    twitterUrl: "",
    websiteUrl: "",
  });
  const [coverLetterTone, setCoverLetterTone] = useState<'professional' | 'friendly' | 'confident'>('professional');
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);

  useEffect(() => {
    if (user?.slackUserId) {
      setMySlackUserId(user.slackUserId);
    }
    // Load marketing profile from user
    if (user) {
      setMarketingProfile({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "", // Read-only from OAuth
        phone: formatPhoneNumber(user.marketingPhone || ""),
        title: user.marketingTitle || "",
        company: user.marketingCompany || "Spyglass Realty",
        headshotUrl: user.marketingHeadshotUrl || "",
      });
    }
  }, [user]);

  const { data: coordinators = [], isLoading } = useQuery<Coordinator[]>({
    queryKey: ["/api/coordinators"],
  });

  // Agent profile query - refetch on window focus for cross-device sync
  const { data: agentProfileData } = useQuery<{
    profile: AgentProfile | null;
    user: any;
  }>({
    queryKey: ["/api/agent/profile"],
    staleTime: 30000, // Consider stale after 30 seconds for cross-device sync
    refetchOnWindowFocus: true, // Refetch when user returns to the app/tab
  });

  // Load agent profile when data arrives
  useEffect(() => {
    if (agentProfileData?.profile) {
      setAgentProfile({
        bio: agentProfileData.profile.bio || "",
        defaultCoverLetter: agentProfileData.profile.defaultCoverLetter || "",
        facebookUrl: agentProfileData.profile.facebookUrl || "",
        instagramUrl: agentProfileData.profile.instagramUrl || "",
        linkedinUrl: agentProfileData.profile.linkedinUrl || "",
        twitterUrl: agentProfileData.profile.twitterUrl || "",
        websiteUrl: agentProfileData.profile.websiteUrl || "",
      });
    }
  }, [agentProfileData]);

  // CMA Resources state
  const [showAddLinkDialog, setShowAddLinkDialog] = useState(false);
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [editingResource, setEditingResource] = useState<AgentResource | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const resourceFileInputRef = useRef<HTMLInputElement>(null);

  // Marketing Branding state (QR Code, Company Logo, Secondary Logo only - Agent Photo uses marketingProfile.headshotUrl)
  const [marketingBranding, setMarketingBranding] = useState({
    qrCode: null as string | null,
    companyLogo: null as string | null,
    companyLogoUseDefault: true,
    secondaryLogo: null as string | null,
    secondaryLogoUseDefault: true,
  });
  const qrCodeInputRef = useRef<HTMLInputElement>(null);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const secondaryLogoInputRef = useRef<HTMLInputElement>(null);

  // Marketing Branding query
  const { data: marketingBrandingData, isLoading: marketingBrandingLoading } = useQuery<{
    agentPhoto: string | null;
    agentTitle: string;
    qrCode: string | null;
    companyLogo: string | null;
    companyLogoUseDefault: boolean;
    secondaryLogo: string | null;
    secondaryLogoUseDefault: boolean;
  }>({
    queryKey: ["/api/settings/marketing-profile"],
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Load marketing branding when data arrives
  useEffect(() => {
    if (marketingBrandingData) {
      setMarketingBranding({
        qrCode: marketingBrandingData.qrCode || null,
        companyLogo: marketingBrandingData.companyLogo || null,
        companyLogoUseDefault: marketingBrandingData.companyLogoUseDefault ?? true,
        secondaryLogo: marketingBrandingData.secondaryLogo || null,
        secondaryLogoUseDefault: marketingBrandingData.secondaryLogoUseDefault ?? true,
      });
    }
  }, [marketingBrandingData]);

  // Marketing branding image upload handler
  const handleBrandingImageUpload = (field: keyof typeof marketingBranding) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File Too Large", description: "Please upload an image under 5MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setMarketingBranding(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear marketing branding image handler
  const handleClearBrandingImage = (field: keyof typeof marketingBranding) => {
    setMarketingBranding(prev => ({ ...prev, [field]: null }));
  };

  // CMA Resources query
  const { data: agentResources = [], isLoading: resourcesLoading } = useQuery<AgentResource[]>({
    queryKey: ["/api/agent/resources"],
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Create resource mutation
  const createResourceMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; url?: string; fileUrl?: string; fileName?: string }) => {
      const res = await apiRequest("POST", "/api/agent/resources", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Resource added", description: "Your resource has been added successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/resources"] });
      setShowAddLinkDialog(false);
      setNewLinkName("");
      setNewLinkUrl("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add resource", variant: "destructive" });
    },
  });

  // Update resource mutation
  const updateResourceMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; url?: string; isActive?: boolean }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest("PATCH", `/api/agent/resources/${id}`, updateData);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Resource updated", description: "Your resource has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/resources"] });
      setEditingResource(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update resource", variant: "destructive" });
    },
  });

  // Delete resource mutation
  const deleteResourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/agent/resources/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Resource deleted", description: "Your resource has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/resources"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete resource", variant: "destructive" });
    },
  });

  // Handle file upload for resources
  const handleResourceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a PDF or Word document", variant: "destructive" });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload a file smaller than 50MB", variant: "destructive" });
      return;
    }

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/agent/resources/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upload failed');
      }

      const { fileUrl, fileName } = await res.json();

      // Create the resource with the uploaded file
      await createResourceMutation.mutateAsync({
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for display name
        type: 'file',
        fileUrl,
        fileName,
      });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Failed to upload file", variant: "destructive" });
    } finally {
      setIsUploadingFile(false);
      if (resourceFileInputRef.current) {
        resourceFileInputRef.current.value = '';
      }
    }
  };

  // Handle add link
  const handleAddLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) {
      toast({ title: "Required fields", description: "Please enter a name and URL", variant: "destructive" });
      return;
    }

    let url = newLinkUrl.trim();
    if (!url.match(/^https?:\/\//i)) {
      url = `https://${url}`;
    }

    createResourceMutation.mutate({
      name: newLinkName.trim(),
      type: 'link',
      url,
    });
  };

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
      firstName?: string;
      lastName?: string;
      marketingTitle?: string;
      marketingPhone?: string;
      marketingCompany?: string;
      marketingHeadshotUrl?: string;
    }) => {
      const res = await apiRequest("PATCH", "/api/user/graphics-settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Marketing profile saved", description: "Your agent info will appear on CMA reports and marketing materials." });
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

  const updateAgentProfileMutation = useMutation({
    mutationFn: async (data: typeof agentProfile) => {
      const res = await apiRequest("PUT", "/api/agent/profile", { profile: data });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile saved", description: "Your bio and cover letter have been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/profile"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save profile",
        variant: "destructive",
      });
    },
  });

  const updateSocialLinksMutation = useMutation({
    mutationFn: async (data: Partial<typeof agentProfile>) => {
      const res = await apiRequest("PUT", "/api/agent/profile", { profile: data });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Social links saved", description: "Your social media links have been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/profile"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save social links",
        variant: "destructive",
      });
    },
  });

  const handleGenerateCoverLetter = async () => {
    setIsGeneratingCoverLetter(true);
    try {
      const res = await apiRequest("POST", "/api/ai/generate-default-cover-letter", {
        tone: coverLetterTone,
        existingCoverLetter: agentProfile.defaultCoverLetter || undefined,
      });
      const data = await res.json();
      if (data.coverLetter) {
        setAgentProfile(prev => ({ ...prev, defaultCoverLetter: data.coverLetter }));
        toast({
          title: data.mode === 'enhanced' ? "Cover letter enhanced" : "Cover letter generated",
          description: "Review and save when ready.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate cover letter",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

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

  const handleSaveMarketingProfile = async () => {
    // Save marketing profile fields
    updateMarketingProfileMutation.mutate({
      firstName: marketingProfile.firstName || undefined,
      lastName: marketingProfile.lastName || undefined,
      marketingTitle: marketingProfile.title || undefined,
      marketingPhone: marketingProfile.phone || undefined,
      marketingCompany: marketingProfile.company || undefined,
      marketingHeadshotUrl: marketingProfile.headshotUrl || undefined,
    });

    // Also save branding fields (QR code, company logo, secondary logo)
    try {
      await apiRequest("POST", "/api/settings/marketing-profile", {
        agentPhoto: marketingProfile.headshotUrl || null, // Use the profile photo as agent photo
        agentTitle: marketingProfile.title || 'REALTOR®', // Use the title field
        qrCode: marketingBranding.qrCode,
        companyLogo: marketingBranding.companyLogo,
        companyLogoUseDefault: marketingBranding.companyLogoUseDefault,
        secondaryLogo: marketingBranding.secondaryLogo,
        secondaryLogoUseDefault: marketingBranding.secondaryLogoUseDefault,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/marketing-profile"] });
    } catch (error: any) {
      console.error('Failed to save branding:', error);
      toast({
        title: "Branding Error",
        description: error.message || "Failed to save branding settings",
        variant: "destructive",
      });
    }
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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">Settings</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
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
                Your personal information displayed on CMA reports
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Profile Photo Section */}
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 border-2 border-muted">
                {marketingProfile.headshotUrl ? (
                  <AvatarImage src={marketingProfile.headshotUrl} alt="Agent headshot" />
                ) : null}
                <AvatarFallback className="text-xl">
                  <User className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Label className="text-sm text-muted-foreground">Profile Photo</Label>
                <p className="text-xs text-muted-foreground">
                  Upload a professional headshot photo (max 5MB, JPG or PNG) or paste an image URL.
                </p>
                <Input
                  value={marketingProfile.headshotUrl || ''}
                  onChange={(e) => setMarketingProfile(prev => ({ ...prev, headshotUrl: e.target.value }))}
                  placeholder="https://example.com/photo.jpg"
                  className="text-sm"
                  data-testid="input-headshot-url"
                />
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
                  Change
                </Button>
              </div>
            </div>

            {/* Name Fields Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={marketingProfile.firstName}
                  onChange={(e) => setMarketingProfile(prev => ({ ...prev, firstName: e.target.value }))}
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Smith"
                  value={marketingProfile.lastName}
                  onChange={(e) => setMarketingProfile(prev => ({ ...prev, lastName: e.target.value }))}
                  data-testid="input-last-name"
                />
              </div>
            </div>

            {/* Email and Phone Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={marketingProfile.email}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                  placeholder="agent@spyglassrealty.com"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={marketingProfile.phone}
                  onChange={handlePhoneChange}
                  placeholder="512-452-4125"
                  data-testid="input-phone"
                />
              </div>
            </div>

            {/* Title and Company Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="REALTOR"
                  value={marketingProfile.title}
                  onChange={(e) => setMarketingProfile(prev => ({ ...prev, title: e.target.value }))}
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Spyglass Realty"
                  value={marketingProfile.company}
                  onChange={(e) => setMarketingProfile(prev => ({ ...prev, company: e.target.value }))}
                  data-testid="input-company"
                />
              </div>
            </div>

            {/* Marketing Branding Section */}
            <div className="pt-6 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Marketing Branding
              </h3>

              {marketingBrandingLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* QR Code */}
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide mb-2 block">
                      QR Code
                    </Label>
                    <div className="flex items-center gap-4">
                      <label
                        htmlFor="qr-code-upload"
                        className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 hover:border-primary/50 transition-colors overflow-hidden"
                      >
                        {marketingBranding.qrCode ? (
                          <img
                            src={marketingBranding.qrCode}
                            alt="QR Code"
                            className="h-full w-full object-contain p-2"
                          />
                        ) : (
                          <QrCode className="h-8 w-8 text-muted-foreground" />
                        )}
                        <input
                          type="file"
                          id="qr-code-upload"
                          accept="image/*"
                          ref={qrCodeInputRef}
                          onChange={handleBrandingImageUpload('qrCode')}
                          className="hidden"
                          data-testid="input-qr-code-upload"
                        />
                      </label>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                          Upload your personal QR code
                        </p>
                        <p className="text-xs text-muted-foreground/60">
                          Links to your website, vCard, or contact page
                        </p>
                        {marketingBranding.qrCode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => handleClearBrandingImage('qrCode')}
                            className="mt-1 text-destructive hover:text-destructive p-0 h-auto"
                            data-testid="button-remove-qr-code"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Logos Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Company Logo */}
                    <div className="space-y-3">
                      <Label className="text-xs font-medium uppercase tracking-wide">
                        Company Logo
                      </Label>
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="use-spyglass-default" className="text-sm cursor-pointer">
                            Use Spyglass Default
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Use the standard Spyglass Realty logo
                          </p>
                        </div>
                        <Switch
                          id="use-spyglass-default"
                          checked={marketingBranding.companyLogoUseDefault}
                          onCheckedChange={(checked) => setMarketingBranding(prev => ({ ...prev, companyLogoUseDefault: checked }))}
                          data-testid="switch-company-logo-default"
                        />
                      </div>

                      <div className="h-20 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                        {marketingBranding.companyLogoUseDefault ? (
                          <img
                            src="/logos/SpyglassRealty_Logo_Black.png"
                            alt="Spyglass Realty"
                            className="h-12 object-contain"
                          />
                        ) : marketingBranding.companyLogo ? (
                          <div className="relative w-full h-full flex items-center justify-center group">
                            <img
                              src={marketingBranding.companyLogo}
                              alt="Company Logo"
                              className="h-full object-contain p-2"
                            />
                            <button
                              type="button"
                              onClick={() => handleClearBrandingImage('companyLogo')}
                              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive/80 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              data-testid="button-remove-company-logo"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <label
                            htmlFor="company-logo-upload"
                            className="flex flex-col items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Upload className="h-5 w-5" />
                            <span className="text-xs">Upload Custom Logo</span>
                            <input
                              type="file"
                              id="company-logo-upload"
                              accept="image/*"
                              ref={companyLogoInputRef}
                              onChange={handleBrandingImageUpload('companyLogo')}
                              className="hidden"
                              data-testid="input-company-logo-upload"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Secondary Logo */}
                    <div className="space-y-3">
                      <Label className="text-xs font-medium uppercase tracking-wide">
                        Secondary Logo
                      </Label>
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="use-leadingre-default" className="text-sm cursor-pointer">
                            Use Leading RE Default
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Use the standard Leading Real Estate logo
                          </p>
                        </div>
                        <Switch
                          id="use-leadingre-default"
                          checked={marketingBranding.secondaryLogoUseDefault}
                          onCheckedChange={(checked) => setMarketingBranding(prev => ({ ...prev, secondaryLogoUseDefault: checked }))}
                          data-testid="switch-secondary-logo-default"
                        />
                      </div>

                      <div className="h-20 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                        {marketingBranding.secondaryLogoUseDefault ? (
                          <img
                            src="/logos/lre-sgr-black.png"
                            alt="Leading Real Estate"
                            className="h-12 object-contain"
                          />
                        ) : marketingBranding.secondaryLogo ? (
                          <div className="relative w-full h-full flex items-center justify-center group">
                            <img
                              src={marketingBranding.secondaryLogo}
                              alt="Secondary Logo"
                              className="h-full object-contain p-2"
                            />
                            <button
                              type="button"
                              onClick={() => handleClearBrandingImage('secondaryLogo')}
                              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive/80 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              data-testid="button-remove-secondary-logo"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <label
                            htmlFor="secondary-logo-upload"
                            className="flex flex-col items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Upload className="h-5 w-5" />
                            <span className="text-xs">Upload Custom Logo</span>
                            <input
                              type="file"
                              id="secondary-logo-upload"
                              accept="image/*"
                              ref={secondaryLogoInputRef}
                              onChange={handleBrandingImageUpload('secondaryLogo')}
                              className="hidden"
                              data-testid="input-secondary-logo-upload"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end pt-4">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#EF4923]/10">
              <FileText className="h-5 w-5 text-[#EF4923]" />
            </div>
            <div>
              <CardTitle>Bio & Default Cover Letter</CardTitle>
              <CardDescription>
                Your bio and default cover letter for CMA reports
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="agentBio">Professional Bio</Label>
              <Textarea
                id="agentBio"
                placeholder="Write a brief professional bio that will be included in your CMA reports..."
                value={agentProfile.bio}
                onChange={(e) => setAgentProfile(prev => ({ ...prev, bio: e.target.value }))}
                className="min-h-[100px] resize-none"
                data-testid="textarea-agent-bio"
              />
              <p className="text-xs text-muted-foreground">
                This bio can be used in CMA reports and other professional documents.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <Label htmlFor="defaultCoverLetter">Default Cover Letter</Label>
                <div className="flex items-center gap-2">
                  <Select value={coverLetterTone} onValueChange={(v) => setCoverLetterTone(v as any)}>
                    <SelectTrigger className="w-[140px]" data-testid="select-cover-letter-tone">
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="confident">Confident</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateCoverLetter}
                    disabled={isGeneratingCoverLetter}
                    className="gap-2"
                    data-testid="button-generate-cover-letter"
                  >
                    {isGeneratingCoverLetter ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {agentProfile.defaultCoverLetter ? "Enhance with AI" : "Generate with AI"}
                  </Button>
                </div>
              </div>
              <Textarea
                id="defaultCoverLetter"
                placeholder="Dear [Client Name],&#10;&#10;Write your default cover letter for CMA reports here..."
                value={agentProfile.defaultCoverLetter}
                onChange={(e) => setAgentProfile(prev => ({ ...prev, defaultCoverLetter: e.target.value }))}
                className="min-h-[180px] resize-none"
                data-testid="textarea-cover-letter"
              />
              <p className="text-xs text-muted-foreground">
                Use [Client Name] as a placeholder - it will be replaced with the actual client's name in each report.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => updateAgentProfileMutation.mutate(agentProfile)}
                disabled={updateAgentProfileMutation.isPending}
                data-testid="button-save-bio-cover-letter"
              >
                {updateAgentProfileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Bio & Cover Letter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#EF4923]/10">
              <FolderOpen className="h-5 w-5 text-[#EF4923]" />
            </div>
            <div>
              <CardTitle>CMA Resources & Links</CardTitle>
              <CardDescription>
                Manage resources that appear in the "Spyglass Resources and Links" slide of your CMA presentations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <label className="flex-1 min-w-[200px] cursor-pointer">
                <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-muted-foreground/30 rounded-lg hover:border-[#EF4923] hover:bg-[#EF4923]/5 transition-colors">
                  {isUploadingFile ? (
                    <Loader2 className="w-5 h-5 text-[#EF4923] animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {isUploadingFile ? "Uploading..." : "Upload PDF/Document"}
                  </span>
                </div>
                <input
                  ref={resourceFileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleResourceFileUpload}
                  disabled={isUploadingFile}
                  data-testid="input-resource-file-upload"
                />
              </label>

              <div 
                className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-muted-foreground/30 rounded-lg hover-elevate cursor-pointer"
                onClick={() => setShowAddLinkDialog(true)}
                data-testid="button-add-resource-link"
              >
                <LinkIcon className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Add External Link</span>
              </div>
            </div>

            <div className="border rounded-lg divide-y">
              <div className="px-4 py-2 bg-muted/50">
                <span className="text-sm font-medium">Your Resources</span>
              </div>

              {resourcesLoading ? (
                <div className="px-4 py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : agentResources.length > 0 ? (
                agentResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="flex items-center gap-3 px-4 py-3"
                    data-testid={`resource-item-${resource.id}`}
                  >
                    <div className="text-muted-foreground cursor-grab">
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                      resource.type === 'file' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {resource.type === 'file' ? (
                        <FileText className="w-4 h-4 text-red-500" />
                      ) : (
                        <ExternalLink className="w-4 h-4 text-blue-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{resource.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {resource.type === 'file' ? resource.fileName : resource.url}
                      </p>
                    </div>

                    <Switch
                      checked={resource.isActive ?? true}
                      onCheckedChange={(checked) =>
                        updateResourceMutation.mutate({ id: resource.id, isActive: checked })
                      }
                      data-testid={`switch-resource-active-${resource.id}`}
                    />

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingResource(resource)}
                        data-testid={`button-edit-resource-${resource.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteResourceMutation.mutate(resource.id)}
                        disabled={deleteResourceMutation.isPending}
                        data-testid={`button-delete-resource-${resource.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No resources added yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Upload documents or add links to display in your CMA presentations
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Resources will appear in the "Spyglass Resources and Links" slide of all your CMA presentations.
              Toggle visibility with the switch.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddLinkDialog} onOpenChange={setShowAddLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add External Link</DialogTitle>
            <DialogDescription>
              Add a link that will appear in your CMA presentations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="linkName">Display Name</Label>
              <Input
                id="linkName"
                placeholder="e.g., Spyglass Listing Presentation"
                value={newLinkName}
                onChange={(e) => setNewLinkName(e.target.value)}
                data-testid="input-new-link-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkUrl">URL</Label>
              <Input
                id="linkUrl"
                placeholder="https://..."
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                data-testid="input-new-link-url"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowAddLinkDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddLink}
              disabled={createResourceMutation.isPending || !newLinkName.trim() || !newLinkUrl.trim()}
              style={{ backgroundColor: '#EF4923' }}
              data-testid="button-save-new-link"
            >
              {createResourceMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Add Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingResource} onOpenChange={(open) => !open && setEditingResource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
            <DialogDescription>
              Update the resource details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editLinkName">Display Name</Label>
              <Input
                id="editLinkName"
                value={editingResource?.name || ''}
                onChange={(e) => setEditingResource(prev => prev ? { ...prev, name: e.target.value } : null)}
                data-testid="input-edit-resource-name"
              />
            </div>
            {editingResource?.type === 'link' && (
              <div className="space-y-2">
                <Label htmlFor="editLinkUrl">URL</Label>
                <Input
                  id="editLinkUrl"
                  value={editingResource?.url || ''}
                  onChange={(e) => setEditingResource(prev => prev ? { ...prev, url: e.target.value } : null)}
                  data-testid="input-edit-resource-url"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditingResource(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingResource) {
                  updateResourceMutation.mutate({
                    id: editingResource.id,
                    name: editingResource.name,
                    url: editingResource.url || undefined,
                  });
                }
              }}
              disabled={updateResourceMutation.isPending}
              style={{ backgroundColor: '#EF4923' }}
              data-testid="button-save-edit-resource"
            >
              {updateResourceMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/10">
              <LinkIcon className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle>Social Media Links</CardTitle>
              <CardDescription>
                Add your social media profiles to display in CMA reports
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="facebookUrl" className="flex items-center gap-2">
                  <SiFacebook className="h-4 w-4 text-[#1877F2]" />
                  Facebook
                </Label>
                <Input
                  id="facebookUrl"
                  type="text"
                  placeholder="facebook.com/yourprofile"
                  value={agentProfile.facebookUrl}
                  onChange={(e) => setAgentProfile(prev => ({ ...prev, facebookUrl: e.target.value }))}
                  data-testid="input-facebook-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagramUrl" className="flex items-center gap-2">
                  <SiInstagram className="h-4 w-4 text-[#E4405F]" />
                  Instagram
                </Label>
                <Input
                  id="instagramUrl"
                  type="text"
                  placeholder="instagram.com/yourprofile"
                  value={agentProfile.instagramUrl}
                  onChange={(e) => setAgentProfile(prev => ({ ...prev, instagramUrl: e.target.value }))}
                  data-testid="input-instagram-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedinUrl" className="flex items-center gap-2">
                  <SiLinkedin className="h-4 w-4 text-[#0A66C2]" />
                  LinkedIn
                </Label>
                <Input
                  id="linkedinUrl"
                  type="text"
                  placeholder="linkedin.com/in/yourprofile"
                  value={agentProfile.linkedinUrl}
                  onChange={(e) => setAgentProfile(prev => ({ ...prev, linkedinUrl: e.target.value }))}
                  data-testid="input-linkedin-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitterUrl" className="flex items-center gap-2">
                  <SiX className="h-4 w-4" />
                  X (Twitter)
                </Label>
                <Input
                  id="twitterUrl"
                  type="text"
                  placeholder="x.com/yourprofile"
                  value={agentProfile.twitterUrl}
                  onChange={(e) => setAgentProfile(prev => ({ ...prev, twitterUrl: e.target.value }))}
                  data-testid="input-twitter-url"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                Website
              </Label>
              <Input
                id="websiteUrl"
                type="text"
                placeholder="yourwebsite.com"
                value={agentProfile.websiteUrl}
                onChange={(e) => setAgentProfile(prev => ({ ...prev, websiteUrl: e.target.value }))}
                data-testid="input-website-url"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => updateSocialLinksMutation.mutate({
                  facebookUrl: agentProfile.facebookUrl,
                  instagramUrl: agentProfile.instagramUrl,
                  linkedinUrl: agentProfile.linkedinUrl,
                  twitterUrl: agentProfile.twitterUrl,
                  websiteUrl: agentProfile.websiteUrl,
                })}
                disabled={updateSocialLinksMutation.isPending}
                data-testid="button-save-social-links"
              >
                {updateSocialLinksMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Social Links
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
              When you create a transaction, Contract Conduit automatically creates a Gmail filter for that property address. 
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

      <NotificationPreferences />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg">Transaction Coordinators</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Add team members who help manage transactions
              </CardDescription>
            </div>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="gap-2 w-full sm:w-auto"
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
        <DialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Add Transaction Coordinator</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
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
        <AlertDialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Remove Coordinator</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
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
