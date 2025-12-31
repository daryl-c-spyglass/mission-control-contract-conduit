import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Download, Image as ImageIcon, FileText, Mail, ChevronLeft, ChevronRight, Loader2, Copy, Check, Upload, MessageSquare } from "lucide-react";
import type { Transaction } from "@shared/schema";
import spyglassLogoWhite from "@assets/White-Orange_(1)_1767129299733.png";
import spyglassLogoBlack from "@assets/Large_Logo_1767129431992.jpeg";
import leadingRELogo from "@assets/download_(3)_1767129649170.png";

interface MarketingMaterialsDialogProps {
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
] as const;

type StatusType = typeof STATUS_OPTIONS[number]["value"];

export function MarketingMaterialsDialog({ open, onOpenChange, transaction }: MarketingMaterialsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const squareCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  const [status, setStatus] = useState<StatusType>("just_listed");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLandscape, setGeneratedLandscape] = useState<string | null>(null);
  const [generatedSquare, setGeneratedSquare] = useState<string | null>(null);
  const [generatedAltStyle, setGeneratedAltStyle] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [socialDescription, setSocialDescription] = useState("");
  const [postToSlack, setPostToSlack] = useState(true);

  const saveAssetMutation = useMutation({
    mutationFn: async ({ type, imageData, fileName }: { type: string; imageData: string; fileName: string }) => {
      const res = await apiRequest("POST", `/api/transactions/${transaction.id}/marketing-assets`, {
        type,
        imageData,
        fileName,
        postToSlack,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/marketing-assets`] });
      toast({
        title: "Asset Saved",
        description: postToSlack ? "Marketing asset saved and posted to Slack." : "Marketing asset saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save marketing asset.",
        variant: "destructive",
      });
    },
  });

  const propertyImages = transaction.propertyImages || [];
  const mlsImages = (transaction.mlsData as any)?.images || [];
  const allImages = [...uploadedPhotos, ...propertyImages, ...mlsImages].filter(Boolean);

  const currentImage = allImages[selectedPhotoIndex] || null;

  const getStatusLabel = (statusValue: StatusType) => {
    return STATUS_OPTIONS.find(s => s.value === statusValue)?.label?.toUpperCase() || "JUST LISTED";
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image under 10MB.",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setUploadedPhotos((prev) => [...prev, dataUrl]);
        setSelectedPhotoIndex(0); // Select the newly uploaded photo
        setGeneratedLandscape(null);
        setGeneratedSquare(null);
      };
      reader.readAsDataURL(file);
    });

    // Reset input to allow re-uploading the same file
    e.target.value = "";
  };

  // Use proxied URL to avoid CORS issues with MLS images
  const getProxiedUrl = (url: string) => {
    if (!url) return url;
    // If already a relative URL or data URL, don't proxy
    if (url.startsWith("/") || url.startsWith("data:")) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const generateGraphics = async () => {
    if (!currentImage) {
      toast({
        title: "No Image Selected",
        description: "Please select a property photo to generate marketing materials.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      // Use proxied URL to avoid CORS issues
      const proxiedUrl = getProxiedUrl(currentImage);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = proxiedUrl;
      });

      // Generate landscape (16:9) graphic
      const landscapeDataUrl = await generateLandscapeGraphic(img);
      setGeneratedLandscape(landscapeDataUrl);

      // Generate square (1:1) graphic
      const squareDataUrl = await generateSquareGraphic(img);
      setGeneratedSquare(squareDataUrl);

      // Generate alt style graphic (with Leading RE logo)
      const altStyleDataUrl = await generateAltStyleGraphic(img);
      setGeneratedAltStyle(altStyleDataUrl);

      toast({
        title: "Graphics Generated",
        description: "Scroll down to see download options.",
      });

      // Scroll to the results section
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (error) {
      console.error("Error generating graphics:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to load property image. The image may not be available for download. Please try a different photo.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateLandscapeGraphic = async (img: HTMLImageElement): Promise<string> => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    
    // 16:9 aspect ratio at 1200x675
    canvas.width = 1200;
    canvas.height = 675;

    const headerHeight = 90;

    // Draw dark header bar
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, canvas.width, headerHeight);

    // Load and draw Spyglass logo
    try {
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        logo.onload = () => resolve();
        logo.onerror = () => resolve();
        logo.src = spyglassLogoWhite;
      });
      
      if (logo.complete && logo.naturalWidth > 0) {
        const logoHeight = 60;
        const logoWidth = (logo.naturalWidth / logo.naturalHeight) * logoHeight;
        const logoX = (canvas.width - logoWidth) / 2;
        const logoY = (headerHeight - logoHeight) / 2;
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      }
    } catch (e) {
      // Fallback to text if logo fails
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SPYGLASS", canvas.width / 2, 40);
      ctx.font = "12px Inter, sans-serif";
      ctx.fillText("R E A L T Y", canvas.width / 2, 60);
    }

    // Draw property image (main area)
    const imageY = headerHeight;
    const imageHeight = canvas.height - headerHeight - 100; // Leave space for bottom bar
    
    // Calculate image dimensions to fill width while maintaining aspect ratio
    const imgAspect = img.width / img.height;
    const targetAspect = canvas.width / imageHeight;
    
    let drawWidth, drawHeight, drawX, drawY;
    if (imgAspect > targetAspect) {
      drawHeight = imageHeight;
      drawWidth = imageHeight * imgAspect;
      drawX = (canvas.width - drawWidth) / 2;
      drawY = imageY;
    } else {
      drawWidth = canvas.width;
      drawHeight = canvas.width / imgAspect;
      drawX = 0;
      drawY = imageY + (imageHeight - drawHeight) / 2;
    }
    
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    // Draw bottom info bar with semi-transparent background
    const bottomY = canvas.height - 100;
    ctx.fillStyle = "rgba(42, 42, 42, 0.9)";
    ctx.fillRect(0, bottomY, canvas.width, 100);

    // Status badge
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(getStatusLabel(status), 30, bottomY + 40);

    // Address (with optional social description)
    ctx.font = "16px Inter, sans-serif";
    const addressText = socialDescription ? `${transaction.propertyAddress}, ${socialDescription}` : transaction.propertyAddress;
    ctx.fillText(addressText, 30, bottomY + 70);

    // Agent info on right side
    if (user?.marketingDisplayName) {
      ctx.textAlign = "right";
      ctx.font = "bold 16px Inter, sans-serif";
      ctx.fillText(user.marketingDisplayName, canvas.width - 120, bottomY + 40);
      
      if (user.marketingPhone) {
        ctx.font = "14px Inter, sans-serif";
        ctx.fillText(user.marketingPhone, canvas.width - 120, bottomY + 65);
      }
    }

    // Agent headshot circle
    if (user?.marketingHeadshotUrl) {
      try {
        const headshot = new Image();
        headshot.crossOrigin = "anonymous";
        const headshotUrl = getProxiedUrl(user.marketingHeadshotUrl);
        await new Promise<void>((resolve) => {
          headshot.onload = () => resolve();
          headshot.onerror = () => resolve();
          headshot.src = headshotUrl;
        });
        
        if (headshot.complete && headshot.naturalWidth > 0) {
          const circleX = canvas.width - 60;
          const circleY = bottomY + 50;
          const circleRadius = 40;
          
          ctx.save();
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          
          const headshotSize = circleRadius * 2;
          ctx.drawImage(headshot, circleX - circleRadius, circleY - circleRadius, headshotSize, headshotSize);
          ctx.restore();
          
          // Draw circle border
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      } catch (e) {
        // Ignore headshot errors
      }
    }

    return canvas.toDataURL("image/png");
  };

  const generateSquareGraphic = async (img: HTMLImageElement): Promise<string> => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    
    // 1:1 aspect ratio at 1080x1080 (Instagram)
    canvas.width = 1080;
    canvas.height = 1080;

    const headerHeight = 100;

    // Draw dark header bar
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, canvas.width, headerHeight);

    // Load and draw Spyglass logo
    try {
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        logo.onload = () => resolve();
        logo.onerror = () => resolve();
        logo.src = spyglassLogoWhite;
      });
      
      if (logo.complete && logo.naturalWidth > 0) {
        const logoHeight = 70;
        const logoWidth = (logo.naturalWidth / logo.naturalHeight) * logoHeight;
        const logoX = (canvas.width - logoWidth) / 2;
        const logoY = (headerHeight - logoHeight) / 2;
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      }
    } catch (e) {
      // Fallback to text if logo fails
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SPYGLASS", canvas.width / 2, 45);
      ctx.font = "14px Inter, sans-serif";
      ctx.fillText("R E A L T Y", canvas.width / 2, 70);
    }

    // Draw property image
    const imageY = headerHeight;
    const bottomBarHeight = 200;
    const imageHeight = canvas.height - headerHeight - bottomBarHeight;
    
    const imgAspect = img.width / img.height;
    const targetAspect = canvas.width / imageHeight;
    
    let drawWidth, drawHeight, drawX, drawY;
    if (imgAspect > targetAspect) {
      drawHeight = imageHeight;
      drawWidth = imageHeight * imgAspect;
      drawX = (canvas.width - drawWidth) / 2;
      drawY = imageY;
    } else {
      drawWidth = canvas.width;
      drawHeight = canvas.width / imgAspect;
      drawX = 0;
      drawY = imageY + (imageHeight - drawHeight) / 2;
    }
    
    // Clip to image area
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, imageY, canvas.width, imageHeight);
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    // Draw bottom info area
    const bottomY = canvas.height - bottomBarHeight;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, bottomY, canvas.width, bottomBarHeight);

    // Status badge
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 36px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(getStatusLabel(status), 30, bottomY + 55);

    // Address (with optional social description)
    ctx.font = "28px Inter, sans-serif";
    const addressText = socialDescription ? `${transaction.propertyAddress}, ${socialDescription}` : transaction.propertyAddress;
    ctx.fillText(addressText, 30, bottomY + 100);

    // Agent info
    if (user?.marketingDisplayName) {
      ctx.font = "18px Inter, sans-serif";
      ctx.fillStyle = "#666666";
      let agentText = user.marketingDisplayName;
      if (user.marketingPhone) {
        agentText += ` | ${user.marketingPhone}`;
      }
      ctx.fillText(agentText, 30, bottomY + 140);
    }

    // Agent headshot circle
    if (user?.marketingHeadshotUrl) {
      try {
        const headshot = new Image();
        headshot.crossOrigin = "anonymous";
        const headshotUrl = getProxiedUrl(user.marketingHeadshotUrl);
        await new Promise<void>((resolve) => {
          headshot.onload = () => resolve();
          headshot.onerror = () => resolve();
          headshot.src = headshotUrl;
        });
        
        if (headshot.complete && headshot.naturalWidth > 0) {
          const circleX = canvas.width - 80;
          const circleY = bottomY + 100;
          const circleRadius = 60;
          
          ctx.save();
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          
          const headshotSize = circleRadius * 2;
          ctx.drawImage(headshot, circleX - circleRadius, circleY - circleRadius, headshotSize, headshotSize);
          ctx.restore();
          
          // Draw circle border
          ctx.strokeStyle = "#e5e5e5";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      } catch (e) {
        // Ignore headshot errors
      }
    }

    return canvas.toDataURL("image/png");
  };

  const downloadImage = (dataUrl: string, filename: string, type: string) => {
    // Download locally
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
    
    // Save to database and optionally post to Slack
    saveAssetMutation.mutate({ type, imageData: dataUrl, fileName: filename });
  };

  const generateAltStyleGraphic = async (img: HTMLImageElement): Promise<string> => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    
    // 1:1 aspect ratio at 1080x1080 (Instagram)
    canvas.width = 1080;
    canvas.height = 1080;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Left panel width for vertical address and logos
    const leftPanelWidth = 200;

    // Load Leading RE logo (top left)
    try {
      const leadingLogo = new Image();
      leadingLogo.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        leadingLogo.onload = () => resolve();
        leadingLogo.onerror = () => resolve();
        leadingLogo.src = leadingRELogo;
      });
      
      if (leadingLogo.complete && leadingLogo.naturalWidth > 0) {
        const logoWidth = 120;
        const logoHeight = (leadingLogo.naturalHeight / leadingLogo.naturalWidth) * logoWidth;
        ctx.drawImage(leadingLogo, 30, 30, logoWidth, logoHeight);
      }
    } catch (e) {
      // Ignore logo errors
    }

    // Draw vertical address text on left side
    ctx.save();
    ctx.translate(60, canvas.height - 200);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 36px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(transaction.propertyAddress.toUpperCase(), 0, 0);
    ctx.restore();

    // Draw property image on right side
    const imageX = leftPanelWidth;
    const imageY = 80;
    const imageWidth = canvas.width - leftPanelWidth - 20;
    const imageHeight = canvas.height - 200;
    
    const imgAspect = img.width / img.height;
    const targetAspect = imageWidth / imageHeight;
    
    let drawWidth, drawHeight, drawX, drawY;
    if (imgAspect > targetAspect) {
      drawHeight = imageHeight;
      drawWidth = imageHeight * imgAspect;
      drawX = imageX + (imageWidth - drawWidth) / 2;
      drawY = imageY;
    } else {
      drawWidth = imageWidth;
      drawHeight = imageWidth / imgAspect;
      drawX = imageX;
      drawY = imageY + (imageHeight - drawHeight) / 2;
    }
    
    // Clip to image area
    ctx.save();
    ctx.beginPath();
    ctx.rect(imageX, imageY, imageWidth, imageHeight);
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    // Bottom section with status and description
    const bottomY = canvas.height - 120;
    
    // Status badge and social description
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 32px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(getStatusLabel(status), canvas.width / 2 + 50, bottomY + 20);
    
    if (socialDescription) {
      ctx.font = "24px Inter, sans-serif";
      ctx.fillText(socialDescription, canvas.width / 2 + 50, bottomY + 55);
    }

    // Agent headshot in bottom left
    if (user?.marketingHeadshotUrl) {
      try {
        const headshot = new Image();
        headshot.crossOrigin = "anonymous";
        const headshotUrl = getProxiedUrl(user.marketingHeadshotUrl);
        await new Promise<void>((resolve) => {
          headshot.onload = () => resolve();
          headshot.onerror = () => resolve();
          headshot.src = headshotUrl;
        });
        
        if (headshot.complete && headshot.naturalWidth > 0) {
          const headshotSize = 120;
          const headshotX = 20;
          const headshotY = canvas.height - headshotSize - 20;
          
          // Draw headshot without circle clip - just as rectangle
          ctx.drawImage(headshot, headshotX, headshotY, headshotSize, headshotSize);
        }
      } catch (e) {
        // Ignore headshot errors
      }
    }

    // Spyglass logo in circular black background (bottom right)
    try {
      // Draw black circle background
      const circleX = canvas.width - 100;
      const circleY = canvas.height - 80;
      const circleRadius = 70;
      
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
      ctx.fill();

      // Load and draw the white/orange logo inside
      const spyglassLogo = new Image();
      spyglassLogo.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        spyglassLogo.onload = () => resolve();
        spyglassLogo.onerror = () => resolve();
        spyglassLogo.src = spyglassLogoWhite;
      });
      
      if (spyglassLogo.complete && spyglassLogo.naturalWidth > 0) {
        const logoWidth = 100;
        const logoHeight = (spyglassLogo.naturalHeight / spyglassLogo.naturalWidth) * logoWidth;
        ctx.drawImage(spyglassLogo, circleX - logoWidth / 2, circleY - logoHeight / 2, logoWidth, logoHeight);
      }
    } catch (e) {
      // Ignore logo errors
    }

    return canvas.toDataURL("image/png");
  };

  const generateEmailTemplate = () => {
    const mlsData = transaction.mlsData as any;
    const price = transaction.salePrice || transaction.listPrice || mlsData?.listPrice;
    const beds = transaction.bedrooms || mlsData?.bedrooms || 0;
    const baths = transaction.bathrooms || mlsData?.bathrooms || 0;
    const sqft = transaction.sqft || mlsData?.sqft || 0;
    const description = mlsData?.description || "";
    
    return `Subject: ${getStatusLabel(status)} - ${transaction.propertyAddress}

${getStatusLabel(status)}!

${transaction.propertyAddress}

${price ? `$${price.toLocaleString()}` : ""}

${beds} Beds | ${baths} Baths | ${sqft.toLocaleString()} Sq Ft

${description}

For more information or to schedule a showing, please contact:

${user?.marketingDisplayName || ""}
${user?.marketingPhone || ""}
${user?.email || ""}

Thank you for your interest!`;
  };

  const copyEmailTemplate = () => {
    navigator.clipboard.writeText(generateEmailTemplate());
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Email template copied to clipboard.",
    });
  };

  const prevImage = () => {
    setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
    setGeneratedLandscape(null);
    setGeneratedSquare(null);
    setGeneratedAltStyle(null);
  };

  const nextImage = () => {
    setSelectedPhotoIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
    setGeneratedLandscape(null);
    setGeneratedSquare(null);
    setGeneratedAltStyle(null);
  };

  // Check if user has graphics settings configured
  const hasGraphicsSettings = user?.marketingDisplayName && user?.marketingPhone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Marketing Materials</DialogTitle>
          <DialogDescription>
            Generate professional marketing graphics for {transaction.propertyAddress}
          </DialogDescription>
        </DialogHeader>

        {!hasGraphicsSettings && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-4 mb-4">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Please set up your Graphics Settings first to include your headshot, name, and phone number on marketing materials.
            </p>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status Type</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v as StatusType); setGeneratedLandscape(null); setGeneratedSquare(null); }}>
                <SelectTrigger data-testid="select-status-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Social Media Description</Label>
              <Input
                placeholder="e.g. Modern 3BR Home"
                value={socialDescription}
                onChange={(e) => {
                  if (e.target.value.length <= 20) {
                    setSocialDescription(e.target.value);
                    setGeneratedLandscape(null);
                    setGeneratedSquare(null);
                  }
                }}
                maxLength={20}
                data-testid="input-social-description"
              />
              <p className="text-xs text-muted-foreground">{socialDescription.length}/20 characters</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Property Photo ({allImages.length > 0 ? `${selectedPhotoIndex + 1} of ${allImages.length}` : "None"})</Label>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={prevImage}
                  disabled={allImages.length <= 1}
                  data-testid="button-prev-photo"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center text-sm text-muted-foreground truncate">
                  {allImages.length === 0 ? "Upload a photo" : "Use arrows to browse"}
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={nextImage}
                  disabled={allImages.length <= 1}
                  data-testid="button-next-photo"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                data-testid="input-photo-upload"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-photo"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Photo
              </Button>
            </div>
          </div>

          {currentImage && (
            <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
              <img
                src={getProxiedUrl(currentImage)}
                alt="Selected property photo"
                className="w-full h-full object-cover"
                data-testid="img-selected-photo"
                onError={(e) => {
                  // Fallback to placeholder if proxy fails
                  (e.target as HTMLImageElement).src = "";
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <div className="text-white">
                  <p className="font-bold text-lg">{getStatusLabel(status)}</p>
                  <p className="text-sm">{transaction.propertyAddress}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border">
            <Checkbox
              id="post-to-slack"
              checked={postToSlack}
              onCheckedChange={(checked) => setPostToSlack(checked === true)}
              data-testid="checkbox-post-to-slack"
            />
            <div className="flex-1">
              <label htmlFor="post-to-slack" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Post to Slack channel
              </label>
              <p className="text-xs text-muted-foreground">
                {transaction.slackChannelId 
                  ? "Assets will be automatically posted when saved" 
                  : "No Slack channel connected"}
              </p>
            </div>
          </div>

          <Button
            onClick={generateGraphics}
            disabled={isGenerating || !currentImage}
            className="w-full"
            data-testid="button-generate-graphics"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4 mr-2" />
                Generate Marketing Graphics
              </>
            )}
          </Button>

          {(generatedLandscape || generatedSquare || generatedAltStyle) && (
            <div ref={resultsRef}>
            <Tabs defaultValue="landscape" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="landscape" data-testid="tab-landscape">
                  Facebook
                </TabsTrigger>
                <TabsTrigger value="square" data-testid="tab-square">
                  Instagram
                </TabsTrigger>
                <TabsTrigger value="altstyle" data-testid="tab-altstyle">
                  Alt Style
                </TabsTrigger>
                <TabsTrigger value="email" data-testid="tab-email">
                  Email
                </TabsTrigger>
              </TabsList>

              <TabsContent value="landscape" className="space-y-4">
                {generatedLandscape && (
                  <Card>
                    <CardContent className="pt-4">
                      <img
                        src={generatedLandscape}
                        alt="Landscape graphic"
                        className="w-full rounded-md"
                        data-testid="img-landscape-preview"
                      />
                      <Button
                        className="w-full mt-4"
                        onClick={() => downloadImage(generatedLandscape, `${transaction.propertyAddress.replace(/[^a-z0-9]/gi, "_")}_facebook.png`, "facebook")}
                        disabled={saveAssetMutation.isPending}
                        data-testid="button-download-landscape"
                      >
                        {saveAssetMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Save & Download Facebook
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="square" className="space-y-4">
                {generatedSquare && (
                  <Card>
                    <CardContent className="pt-4">
                      <img
                        src={generatedSquare}
                        alt="Square graphic"
                        className="w-full max-w-md mx-auto rounded-md"
                        data-testid="img-square-preview"
                      />
                      <Button
                        className="w-full mt-4"
                        onClick={() => downloadImage(generatedSquare, `${transaction.propertyAddress.replace(/[^a-z0-9]/gi, "_")}_instagram.png`, "instagram")}
                        disabled={saveAssetMutation.isPending}
                        data-testid="button-download-square"
                      >
                        {saveAssetMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Save & Download Instagram
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="altstyle" className="space-y-4">
                {generatedAltStyle && (
                  <Card>
                    <CardContent className="pt-4">
                      <img
                        src={generatedAltStyle}
                        alt="Alt style graphic"
                        className="w-full max-w-md mx-auto rounded-md"
                        data-testid="img-altstyle-preview"
                      />
                      <Button
                        className="w-full mt-4"
                        onClick={() => downloadImage(generatedAltStyle, `${transaction.propertyAddress.replace(/[^a-z0-9]/gi, "_")}_altstyle.png`, "alt_style")}
                        disabled={saveAssetMutation.isPending}
                        data-testid="button-download-altstyle"
                      >
                        {saveAssetMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Save & Download Alt Style
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="email" className="space-y-4">
                <Card>
                  <CardContent className="pt-4">
                    <Textarea
                      value={generateEmailTemplate()}
                      readOnly
                      className="min-h-[300px] font-mono text-sm"
                      data-testid="textarea-email-template"
                    />
                    <Button
                      className="w-full mt-4"
                      onClick={copyEmailTemplate}
                      data-testid="button-copy-email"
                    >
                      {emailCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Email Template
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
