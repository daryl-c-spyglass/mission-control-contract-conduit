import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Upload, Check, ZoomIn, RefreshCw } from "lucide-react";
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
    'for_sale': '#22c55e',
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
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<StatusType>("just_listed");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [showEnlargedPreview, setShowEnlargedPreview] = useState(false);
  const [addressOverride, setAddressOverride] = useState("");
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);

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
      setPreviewDataUrl(null);

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
      setPreviewDataUrl(null);
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
      toast({ title: "Saved", description: "Graphic saved to marketing assets." });
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

  const renderCanvas = useCallback(async (size: number = 1080): Promise<string | null> => {
    if (!currentImage) return null;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = size;
    canvas.height = size;
    const s = size / 1080;

    const propertyImg = await loadImage(getProxiedUrl(currentImage));

    const imgAspect = propertyImg.width / propertyImg.height;
    const canvasAspect = 1;
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

    const topGrad = ctx.createLinearGradient(0, 0, 0, 220 * s);
    topGrad.addColorStop(0, "rgba(0,0,0,0.6)");
    topGrad.addColorStop(0.7, "rgba(0,0,0,0.2)");
    topGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, canvas.width, 220 * s);

    const bottomGrad = ctx.createLinearGradient(0, canvas.height - 380 * s, 0, canvas.height);
    bottomGrad.addColorStop(0, "rgba(0,0,0,0)");
    bottomGrad.addColorStop(0.3, "rgba(0,0,0,0.4)");
    bottomGrad.addColorStop(0.7, "rgba(0,0,0,0.7)");
    bottomGrad.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, canvas.height - 380 * s, canvas.width, 380 * s);

    const useDefaultCompany = marketingProfile?.companyLogoUseDefault !== false;
    const useDefaultSecondary = marketingProfile?.secondaryLogoUseDefault !== false;
    const companyLogoSrc = useDefaultCompany
      ? '/logos/SpyglassRealty_Logo_White.png'
      : (marketingProfile?.companyLogo || '/logos/SpyglassRealty_Logo_White.png');
    const secondaryLogoSrc = useDefaultSecondary
      ? '/logos/LeadingRE_White.png'
      : (marketingProfile?.secondaryLogo || '/logos/LeadingRE_White.png');

    const companyLogo = await loadImageSafe(companyLogoSrc);
    if (companyLogo && companyLogo.naturalWidth > 0) {
      const logoHeight = 45 * s;
      const logoWidth = (companyLogo.naturalWidth / companyLogo.naturalHeight) * logoHeight;
      ctx.drawImage(companyLogo, 35 * s, 30 * s, logoWidth, logoHeight);
    }

    const secondaryLogo = await loadImageSafe(secondaryLogoSrc);
    if (secondaryLogo && secondaryLogo.naturalWidth > 0) {
      const logoHeight = 45 * s;
      const logoWidth = (secondaryLogo.naturalWidth / secondaryLogo.naturalHeight) * logoHeight;
      ctx.drawImage(secondaryLogo, canvas.width - logoWidth - 35 * s, 30 * s, logoWidth, logoHeight);
    }

    const statusLabel = getStatusLabel(status);
    ctx.font = `bold ${26 * s}px Inter, Arial, sans-serif`;
    const badgeTextWidth = ctx.measureText(statusLabel).width;
    const badgePadH = 24 * s;
    const badgePadV = 10 * s;
    const badgeHeight = 44 * s;
    const badgeX = (canvas.width - badgeTextWidth - badgePadH * 2) / 2;
    const badgeY = canvas.height - 280 * s;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 12 * s;
    ctx.shadowOffsetY = 3 * s;
    ctx.fillStyle = getStatusBadgeColor(status);
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeTextWidth + badgePadH * 2, badgeHeight, 5 * s);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(statusLabel, canvas.width / 2, badgeY + badgeHeight / 2);

    const parts = displayAddress.split(',').map(p => p.trim());
    const street = parts[0] || '';
    const cityStateZip = parts.slice(1).join(', ');

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8 * s;
    ctx.font = `bold ${38 * s}px Inter, Arial, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(street, canvas.width / 2, canvas.height - 195 * s);
    ctx.restore();

    if (cityStateZip) {
      ctx.font = `${22 * s}px Inter, Arial, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "center";
      ctx.fillText(cityStateZip, canvas.width / 2, canvas.height - 162 * s);
    }

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1 * s;
    ctx.moveTo(canvas.width * 0.15, canvas.height - 140 * s);
    ctx.lineTo(canvas.width * 0.85, canvas.height - 140 * s);
    ctx.stroke();

    const agentSectionY = canvas.height - 95 * s;

    if (agentHeadshot) {
      const headshot = await loadImageSafe(agentHeadshot);
      if (headshot && headshot.naturalWidth > 0) {
        const circleRadius = 32 * s;
        let contentWidth = circleRadius * 2;
        let nameWidth = 0;

        if (agentName) {
          ctx.font = `600 ${20 * s}px Inter, Arial, sans-serif`;
          nameWidth = ctx.measureText(agentName + ", REALTOR\u00AE").width;
          let phoneWidth = 0;
          if (agentPhone) {
            ctx.font = `${16 * s}px Inter, Arial, sans-serif`;
            phoneWidth = ctx.measureText(agentPhone).width;
          }
          contentWidth += 14 * s + Math.max(nameWidth, phoneWidth);
        }

        const startX = (canvas.width - contentWidth) / 2;
        const circleX = startX + circleRadius;
        const circleY = agentSectionY;

        ctx.save();
        ctx.beginPath();
        ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(headshot, circleX - circleRadius, circleY - circleRadius, circleRadius * 2, circleRadius * 2);
        ctx.restore();

        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
        ctx.stroke();

        if (agentName) {
          const textX = circleX + circleRadius + 14 * s;
          ctx.textAlign = "left";
          ctx.font = `600 ${20 * s}px Inter, Arial, sans-serif`;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(`${agentName}, REALTOR\u00AE`, textX, agentSectionY - 6 * s);

          if (agentPhone) {
            ctx.font = `${16 * s}px Inter, Arial, sans-serif`;
            ctx.fillStyle = "rgba(255,255,255,0.75)";
            ctx.fillText(agentPhone, textX, agentSectionY + 18 * s);
          }
        }
      }
    } else if (agentName) {
      ctx.textAlign = "center";
      ctx.font = `600 ${20 * s}px Inter, Arial, sans-serif`;
      ctx.fillStyle = "#ffffff";
      const nameText = agentPhone ? `${agentName}, REALTOR\u00AE  |  ${agentPhone}` : agentName;
      ctx.fillText(nameText, canvas.width / 2, agentSectionY + 5 * s);
    }

    return canvas.toDataURL("image/png");
  }, [currentImage, status, displayAddress, agentName, agentPhone, agentHeadshot, marketingProfile]);

  useEffect(() => {
    if (!open || !currentImage) {
      setPreviewDataUrl(null);
      return;
    }

    let cancelled = false;
    setIsRenderingPreview(true);

    const timeout = setTimeout(() => {
      renderCanvas(540).then((url) => {
        if (!cancelled) {
          setPreviewDataUrl(url);
          setIsRenderingPreview(false);
        }
      }).catch(() => {
        if (!cancelled) setIsRenderingPreview(false);
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [open, currentImage, status, displayAddress, agentName, agentPhone, agentHeadshot, marketingProfile, renderCanvas]);

  const generateGraphic = useCallback(async () => {
    if (!currentImage) {
      toast({ title: "No Image", description: "Select a property photo first.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);

    try {
      const dataUrl = await renderCanvas(1080);
      if (dataUrl) {
        setGeneratedImage(dataUrl);
        toast({ title: "Graphic Generated", description: "Ready to download." });
      }
    } catch (error) {
      console.error("Error generating graphic:", error);
      toast({ title: "Generation Failed", description: "Failed to load images. Try a different photo.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [currentImage, renderCanvas, toast]);

  const handleDownload = async () => {
    if (!generatedImage) {
      await generateGraphic();
      return;
    }

    const fileName = `${transaction.propertyAddress.replace(/[^a-z0-9]/gi, "_")}_graphic.png`;
    await saveAssetMutation.mutateAsync({ imageData: generatedImage, fileName });

    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const previewImage = generatedImage || previewDataUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-base sm:text-lg" data-testid="text-graphic-title">Graphic Generator</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Create professional social media graphics for {transaction.propertyAddress}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-6 flex-1 overflow-hidden">
          <div className="space-y-4 overflow-y-auto pr-2" data-testid="graphic-form-column">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Select Photo</Label>
              <div className="grid grid-cols-5 gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-muted/30 rounded-md">
                {allImages.slice(0, 30).map((photo, index) => {
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
                        <div className="absolute top-0.5 left-0.5 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between flex-wrap gap-1">
                <p className="text-xs text-muted-foreground">
                  {allImages.length} photo{allImages.length !== 1 ? 's' : ''}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-graphic-upload"
                >
                  <Upload className="h-3 w-3 mr-1" />
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
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v as StatusType); setGeneratedImage(null); }}>
                <SelectTrigger data-testid="select-graphic-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                          style={{ backgroundColor: getStatusBadgeColor(opt.value) }}
                        />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</Label>
              <Input
                placeholder={transaction.propertyAddress}
                value={addressOverride}
                onChange={(e) => { setAddressOverride(e.target.value); setGeneratedImage(null); }}
                data-testid="input-graphic-address"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank to use default: {transaction.propertyAddress}
              </p>
            </div>

            <div className="p-3 bg-muted/30 rounded-md space-y-2.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Auto-populated from Settings</Label>
              <div className="flex items-center gap-3">
                {agentHeadshot && (
                  <img src={getProxiedUrl(agentHeadshot)} alt="Agent" className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-muted" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{agentName || "Agent name not set"}</p>
                  <p className="text-xs text-muted-foreground">{agentPhone || "Phone not set"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                <span>Logos: Spyglass Realty + Partner</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-3 overflow-hidden" data-testid="graphic-preview-column">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Live Preview
                <span className="text-muted-foreground/60 font-normal normal-case ml-1">(1080 x 1080px)</span>
              </Label>
              {isRenderingPreview && (
                <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            <div
              className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center flex-1 min-h-0 cursor-pointer group aspect-square max-h-[55vh]"
              onClick={() => previewImage && setShowEnlargedPreview(true)}
              data-testid="graphic-preview-container"
            >
              {previewImage ? (
                <>
                  <img
                    src={previewImage}
                    alt="Graphic preview"
                    className="w-full h-full object-contain"
                    data-testid="img-graphic-preview"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                    <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground p-6">
                  <div className="w-16 h-16 rounded-lg bg-muted/20 flex items-center justify-center">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm">Select a photo to see preview</p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground text-center">Click preview to enlarge</p>
          </div>
        </div>

        <canvas ref={previewCanvasRef} className="hidden" />

        <div className="flex items-center justify-end gap-3 pt-3 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-graphic-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!currentImage || isGenerating || saveAssetMutation.isPending}
            data-testid="button-graphic-download"
          >
            {(isGenerating || saveAssetMutation.isPending) ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Save & Download
          </Button>
        </div>

        {showEnlargedPreview && previewImage && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setShowEnlargedPreview(false)}
            data-testid="graphic-enlarged-overlay"
          >
            <img
              src={previewImage}
              alt="Enlarged preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              data-testid="img-graphic-enlarged"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
