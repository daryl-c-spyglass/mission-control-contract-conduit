import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Image as ImageIcon, Upload, Check, Sparkles, Wand2, X, ZoomIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Transaction, AgentProfile, AgentMarketingProfile } from "@shared/schema";

interface GraphicGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
}

const STATUS_OPTIONS = [
  { value: "just_listed", label: "Just Listed" },
  { value: "for_sale", label: "For Sale" },
  { value: "for_lease", label: "For Lease" },
  { value: "under_contract", label: "Under Contract" },
  { value: "just_sold", label: "Just Sold" },
  { value: "price_improvement", label: "Price Improvement" },
  { value: "open_house", label: "Open House" },
  { value: "coming_soon", label: "Coming Soon" },
] as const;

type StatusType = typeof STATUS_OPTIONS[number]["value"];

const getStatusBadgeColor = (statusValue: StatusType): string => {
  const colors: Record<StatusType, string> = {
    'just_listed': '#f97316',
    'for_sale': '#f97316',
    'for_lease': '#06b6d4',
    'under_contract': '#3b82f6',
    'just_sold': '#ef4444',
    'price_improvement': '#8b5cf6',
    'open_house': '#f97316',
    'coming_soon': '#14b8a6',
  };
  return colors[statusValue] || '#f97316';
};

export function GraphicGeneratorDialog({
  open,
  onOpenChange,
  transaction,
}: GraphicGeneratorDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<StatusType>("just_listed");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [showEnlargedPreview, setShowEnlargedPreview] = useState(false);
  const [addressOverride, setAddressOverride] = useState("");

  const { data: agentProfileData } = useQuery<{
    profile: AgentProfile | null;
    user: any;
  }>({
    queryKey: ["/api/agent/profile"],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: marketingProfile } = useQuery<AgentMarketingProfile>({
    queryKey: ["/api/settings/marketing-profile"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const mlsData = transaction.mlsData as any;

  const allImages = useMemo(() => {
    const uploaded = uploadedPhotos || [];
    const property = transaction.propertyImages || [];
    const mls = mlsData?.images || mlsData?.photos || [];
    return [...uploaded, ...property, ...mls].filter(Boolean);
  }, [uploadedPhotos, transaction.propertyImages, mlsData]);

  const currentImage = allImages[selectedPhotoIndex] || null;

  const agentName = useMemo(() => {
    if (agentProfileData?.user) {
      return [agentProfileData.user.firstName, agentProfileData.user.lastName].filter(Boolean).join(' ');
    }
    return '';
  }, [agentProfileData]);

  const agentPhone = useMemo(() => {
    return agentProfileData?.user?.phoneNumber || user?.marketingPhone || '';
  }, [agentProfileData, user]);

  const agentHeadshot = useMemo(() => {
    return marketingProfile?.agentPhoto || user?.marketingHeadshotUrl || agentProfileData?.profile?.headshotUrl || '';
  }, [marketingProfile, user, agentProfileData]);

  const displayAddress = useMemo(() => {
    return addressOverride || transaction.propertyAddress || '';
  }, [addressOverride, transaction.propertyAddress]);

  useEffect(() => {
    if (open) {
      setGeneratedImage(null);
      setShowEnlargedPreview(false);
      setAddressOverride("");

      const mlsStatus = (mlsData?.status || transaction.status || "").toLowerCase();
      let detectedStatus: StatusType = 'just_listed';
      if (mlsStatus.includes('contract') || mlsStatus.includes('pending')) {
        detectedStatus = 'under_contract';
      } else if (mlsStatus.includes('sold') || mlsStatus.includes('closed')) {
        detectedStatus = 'just_sold';
      } else if (mlsStatus.includes('lease')) {
        detectedStatus = 'for_lease';
      } else if (mlsStatus.includes('coming')) {
        detectedStatus = 'coming_soon';
      } else if (mlsStatus.includes('active')) {
        const dom = mlsData?.simpleDaysOnMarket || mlsData?.daysOnMarket || 0;
        detectedStatus = dom <= 7 ? 'just_listed' : 'for_sale';
      }
      setStatus(detectedStatus);
    }
  }, [open, mlsData, transaction.status]);

  useEffect(() => {
    if (!open) {
      setUploadedPhotos([]);
      setSelectedPhotoIndex(0);
      setGeneratedImage(null);
      setShowEnlargedPreview(false);
    }
  }, [open]);

  const saveAssetMutation = useMutation({
    mutationFn: async ({ imageData, fileName }: { imageData: string; fileName: string }) => {
      const res = await apiRequest("POST", `/api/transactions/${transaction.id}/marketing-assets`, {
        type: 'graphic-generator',
        imageData,
        fileName,
        postToSlack: true,
        metadata: { config: { status, photoUrl: currentImage } },
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/marketing-assets`] });
      toast({ title: "Asset Saved", description: "Graphic saved to marketing assets." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to save.", variant: "destructive" });
    },
  });

  const getProxiedUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith("/") || url.startsWith("data:")) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const getStatusLabel = (statusValue: StatusType) => {
    return STATUS_OPTIONS.find(s => s.value === statusValue)?.label?.toUpperCase() || "JUST LISTED";
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File Too Large", description: "Max 10MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setUploadedPhotos((prev) => [...prev, dataUrl]);
        setSelectedPhotoIndex(0);
        setGeneratedImage(null);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = src;
    });
  };

  const loadImageSafe = async (src: string): Promise<HTMLImageElement | null> => {
    try {
      return await loadImage(getProxiedUrl(src));
    } catch {
      return null;
    }
  };

  const generateGraphic = useCallback(async () => {
    if (!currentImage) {
      toast({ title: "No Image", description: "Select a property photo first.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = 1080;
      canvas.height = 1080;

      const propertyImg = await loadImage(getProxiedUrl(currentImage));

      const imgAspect = propertyImg.width / propertyImg.height;
      const canvasAspect = canvas.width / canvas.height;
      let drawWidth, drawHeight, drawX, drawY;
      if (imgAspect > canvasAspect) {
        drawHeight = canvas.height;
        drawWidth = canvas.height * imgAspect;
        drawX = (canvas.width - drawWidth) / 2;
        drawY = 0;
      } else {
        drawWidth = canvas.width;
        drawHeight = canvas.width / imgAspect;
        drawX = 0;
        drawY = (canvas.height - drawHeight) / 2;
      }
      ctx.drawImage(propertyImg, drawX, drawY, drawWidth, drawHeight);

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(0, 0, canvas.width, 90);

      const bottomGrad = ctx.createLinearGradient(0, canvas.height - 300, 0, canvas.height);
      bottomGrad.addColorStop(0, "rgba(0,0,0,0)");
      bottomGrad.addColorStop(0.4, "rgba(0,0,0,0.5)");
      bottomGrad.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, canvas.height - 300, canvas.width, 300);

      const useDefaultCompany = marketingProfile?.companyLogoUseDefault !== false;
      const useDefaultSecondary = marketingProfile?.secondaryLogoUseDefault !== false;
      const companyLogoSrc = useDefaultCompany
        ? '/logos/SpyglassRealty_Logo_Black.png'
        : (marketingProfile?.companyLogo || '/logos/SpyglassRealty_Logo_Black.png');
      const secondaryLogoSrc = useDefaultSecondary
        ? '/logos/LeadingRE_Black.png'
        : (marketingProfile?.secondaryLogo || '/logos/LeadingRE_Black.png');

      const bannerHeight = 90;
      const logoPad = 25;

      const companyLogo = await loadImageSafe(companyLogoSrc);
      if (companyLogo && companyLogo.naturalWidth > 0) {
        const logoHeight = 50;
        const logoWidth = (companyLogo.naturalWidth / companyLogo.naturalHeight) * logoHeight;
        ctx.drawImage(companyLogo, logoPad, (bannerHeight - logoHeight) / 2, logoWidth, logoHeight);
      }

      const secondaryLogo = await loadImageSafe(secondaryLogoSrc);
      if (secondaryLogo && secondaryLogo.naturalWidth > 0) {
        const logoHeight = 50;
        const logoWidth = (secondaryLogo.naturalWidth / secondaryLogo.naturalHeight) * logoHeight;
        ctx.drawImage(secondaryLogo, canvas.width - logoWidth - logoPad, (bannerHeight - logoHeight) / 2, logoWidth, logoHeight);
      }

      const statusLabel = getStatusLabel(status);
      ctx.font = "bold 28px Inter, Arial, sans-serif";
      const badgeTextWidth = ctx.measureText(statusLabel).width;
      const badgePadding = 20;
      const badgeHeight = 48;
      const badgeX = (canvas.width - badgeTextWidth - badgePadding * 2) / 2;
      const badgeY = canvas.height - 260;

      ctx.fillStyle = getStatusBadgeColor(status);
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeTextWidth + badgePadding * 2, badgeHeight, 6);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(statusLabel, canvas.width / 2, badgeY + 34);

      const parts = displayAddress.split(',').map(p => p.trim());
      const street = parts[0] || '';
      const cityStateZip = parts.slice(1).join(', ');

      ctx.font = "bold 36px Inter, Arial, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(street, canvas.width / 2, canvas.height - 170);

      if (cityStateZip) {
        ctx.font = "24px Inter, Arial, sans-serif";
        ctx.fillStyle = "#dddddd";
        ctx.fillText(cityStateZip, canvas.width / 2, canvas.height - 135);
      }

      const agentY = canvas.height - 60;

      if (agentHeadshot) {
        const headshot = await loadImageSafe(agentHeadshot);
        if (headshot && headshot.naturalWidth > 0) {
          const circleRadius = 35;
          const circleX = agentName ? canvas.width / 2 - 120 : canvas.width / 2;
          const circleY = agentY;

          ctx.save();
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          const headshotSize = circleRadius * 2;
          ctx.drawImage(headshot, circleX - circleRadius, circleY - circleRadius, headshotSize, headshotSize);
          ctx.restore();

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.stroke();

          if (agentName) {
            ctx.textAlign = "left";
            ctx.font = "bold 22px Inter, Arial, sans-serif";
            ctx.fillStyle = "#ffffff";
            const nameText = agentPhone ? `${agentName}, REALTOR\u00AE` : agentName;
            ctx.fillText(nameText, circleX + circleRadius + 15, agentY - 5);

            if (agentPhone) {
              ctx.font = "18px Inter, Arial, sans-serif";
              ctx.fillStyle = "#dddddd";
              ctx.fillText(agentPhone, circleX + circleRadius + 15, agentY + 20);
            }
          }
        }
      } else if (agentName) {
        ctx.textAlign = "center";
        ctx.font = "bold 22px Inter, Arial, sans-serif";
        ctx.fillStyle = "#ffffff";
        const nameText = agentPhone ? `${agentName}, REALTOR\u00AE | ${agentPhone}` : agentName;
        ctx.fillText(nameText, canvas.width / 2, agentY + 5);
      }

      setGeneratedImage(canvas.toDataURL("image/png"));
      toast({ title: "Graphic Generated", description: "Ready to download." });
    } catch (error) {
      console.error("Error generating graphic:", error);
      toast({ title: "Generation Failed", description: "Failed to load images. Try a different photo.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [currentImage, status, displayAddress, agentName, agentPhone, agentHeadshot, marketingProfile, toast]);

  const handleDownload = async () => {
    if (!generatedImage) return;
    const fileName = `${transaction.propertyAddress.replace(/[^a-z0-9]/gi, "_")}_graphic.png`;

    await saveAssetMutation.mutateAsync({ imageData: generatedImage, fileName });

    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-base sm:text-lg">Graphic Generator</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Create professional social media graphics for {transaction.propertyAddress}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-6 flex-1 overflow-hidden">
          <div className="space-y-4 overflow-y-auto pr-2" data-testid="graphic-form-column">
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <Label>Select Photo</Label>
              </div>
              <div className="grid grid-cols-5 gap-1.5 max-h-28 overflow-y-auto p-1 bg-muted/30 rounded-md">
                {allImages.slice(0, 20).map((photo, index) => {
                  const isSelected = selectedPhotoIndex === index;
                  return (
                    <button
                      key={index}
                      onClick={() => { setSelectedPhotoIndex(index); setGeneratedImage(null); }}
                      className={cn(
                        "relative aspect-square rounded overflow-hidden border-2 transition-all",
                        isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/40"
                      )}
                      data-testid={`button-graphic-photo-${index}`}
                    >
                      <img
                        src={getProxiedUrl(photo)}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      {isSelected && (
                        <div className="absolute top-0.5 left-0.5 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {allImages.length} photos
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-6 text-xs gap-1"
                  data-testid="button-graphic-upload"
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                data-testid="input-graphic-photo-upload"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v as StatusType); setGeneratedImage(null); }}>
                <SelectTrigger data-testid="select-graphic-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Address (editable)</Label>
              <Input
                placeholder={transaction.propertyAddress}
                value={addressOverride}
                onChange={(e) => { setAddressOverride(e.target.value); setGeneratedImage(null); }}
                data-testid="input-graphic-address"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use: {transaction.propertyAddress}
              </p>
            </div>

            <div className="p-3 bg-muted/30 rounded-md space-y-2">
              <Label className="text-xs text-muted-foreground">Auto-populated from Settings</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Agent: </span>
                  <span className="font-medium">{agentName || "Not set"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  <span className="font-medium">{agentPhone || "Not set"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Logos: </span>
                <span className="font-medium">Spyglass Realty + Partner</span>
              </div>
              {agentHeadshot && (
                <div className="flex items-center gap-2">
                  <img src={getProxiedUrl(agentHeadshot)} alt="Agent" className="w-8 h-8 rounded-full object-cover" />
                  <span className="text-xs text-muted-foreground">Agent headshot</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-3 overflow-hidden" data-testid="graphic-preview-column">
            <Label>Preview (1080 x 1080px)</Label>
            <div
              className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center flex-1 min-h-0 cursor-pointer group aspect-square max-h-[55vh]"
              onClick={() => (generatedImage || currentImage) && setShowEnlargedPreview(true)}
              data-testid="graphic-preview-container"
            >
              {generatedImage ? (
                <>
                  <img
                    src={generatedImage}
                    alt="Generated graphic"
                    className="w-full h-full object-contain"
                    data-testid="img-graphic-generated"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : currentImage ? (
                <>
                  <div className="relative w-full h-full">
                    <img
                      src={getProxiedUrl(currentImage)}
                      alt="Selected photo"
                      className="w-full h-full object-cover"
                      data-testid="img-graphic-selected"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute top-0 left-0 right-0 h-[60px] bg-white/90 flex items-center justify-between px-3">
                      <p className="text-[10px] font-semibold text-gray-800 tracking-wide">SPYGLASS REALTY</p>
                      <p className="text-[10px] font-semibold text-gray-800 tracking-wide">PARTNER</p>
                    </div>
                    <div className="absolute bottom-4 left-0 right-0 text-center px-4">
                      <span
                        className="inline-block px-3 py-1 rounded text-xs font-semibold uppercase text-white"
                        style={{ backgroundColor: getStatusBadgeColor(status) }}
                      >
                        {getStatusLabel(status)}
                      </span>
                      <p className="text-white text-sm font-medium mt-2 truncate">
                        {displayAddress.split(',')[0]}
                      </p>
                      {agentName && (
                        <p className="text-white/70 text-xs mt-1">{agentName}</p>
                      )}
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                    <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground p-8">
                  <ImageIcon className="h-12 w-12 opacity-30" />
                  <span className="text-sm">No photo selected</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {generatedImage ? "Click to enlarge" : "Select a photo and click Generate"}
            </p>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-graphic-cancel"
              >
                Cancel
              </Button>
              {generatedImage ? (
                <Button
                  onClick={handleDownload}
                  disabled={saveAssetMutation.isPending}
                  className="flex-1"
                  data-testid="button-graphic-download"
                >
                  {saveAssetMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Save & Download
                </Button>
              ) : (
                <Button
                  onClick={generateGraphic}
                  disabled={isGenerating || !currentImage}
                  className="flex-1"
                  data-testid="button-graphic-generate"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Generate Graphic
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {showEnlargedPreview && (generatedImage || currentImage) && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setShowEnlargedPreview(false)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setShowEnlargedPreview(false)}
              data-testid="button-graphic-close-enlarged"
            >
              <X className="h-6 w-6" />
            </Button>
            <img
              src={generatedImage || getProxiedUrl(currentImage!)}
              alt="Enlarged preview"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
