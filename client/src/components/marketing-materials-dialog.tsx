import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Download, Image as ImageIcon, Loader2, Copy, Check, Upload, MessageSquare, Sparkles, Wand2, ZoomIn, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Transaction } from "@shared/schema";
import spyglassLogoWhite from "@assets/White-Orange_(1)_1767129299733.png";
import spyglassLogoBlack from "@assets/Large_Logo_1767129431992.jpeg";
import leadingRELogo from "@assets/download_(3)_1767129649170.png";

export interface SocialGraphicConfig {
  status: string;
  photoUrl?: string;
  description?: string;
}

interface MarketingMaterialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  initialData?: SocialGraphicConfig;
  assetId?: string;
  onAssetSaved?: () => void;
  initialFormat?: 'instagram-post' | 'instagram-story' | 'facebook-post' | 'x-post' | 'tiktok-cover' | 'square' | 'landscape' | 'story';
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

const FORMAT_OPTIONS = [
  { id: 'instagram-post', name: 'IG Post', fullName: 'Instagram Post', width: 1080, height: 1080, ratio: '1:1' },
  { id: 'instagram-story', name: 'IG Story', fullName: 'Instagram Story', width: 1080, height: 1920, ratio: '9:16' },
  { id: 'facebook-post', name: 'Facebook', fullName: 'Facebook Post', width: 1200, height: 630, ratio: '1.91:1' },
  { id: 'x-post', name: 'X Post', fullName: 'X (Twitter) Post', width: 1200, height: 675, ratio: '16:9' },
  { id: 'tiktok-cover', name: 'TikTok', fullName: 'TikTok Cover', width: 1080, height: 1920, ratio: '9:16' },
] as const;

type FormatType = typeof FORMAT_OPTIONS[number];

export function MarketingMaterialsDialog({ 
  open, 
  onOpenChange, 
  transaction,
  initialData,
  assetId,
  onAssetSaved,
  initialFormat,
}: MarketingMaterialsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isEditMode = Boolean(initialData && assetId);
  
  const [status, setStatus] = useState<StatusType>("just_listed");
  const [selectedFormat, setSelectedFormat] = useState<FormatType>(FORMAT_OPTIONS[0]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [socialDescription, setSocialDescription] = useState("");
  const [postToSlack, setPostToSlack] = useState(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [recommendedIndices, setRecommendedIndices] = useState<number[]>([]);
  const [showEnlargedPreview, setShowEnlargedPreview] = useState(false);
  
  // Open House specific fields
  const [openHouseDate, setOpenHouseDate] = useState<string>("");
  const [openHouseTimeStart, setOpenHouseTimeStart] = useState<string>("13:00");
  const [openHouseTimeEnd, setOpenHouseTimeEnd] = useState<string>("16:00");

  const saveAssetMutation = useMutation({
    mutationFn: async ({ type, imageData, fileName, config }: { type: string; imageData: string; fileName: string; config?: SocialGraphicConfig }) => {
      const metadata = { config };
      
      if (isEditMode && assetId) {
        const res = await apiRequest("PATCH", `/api/transactions/${transaction.id}/marketing-assets/${assetId}`, {
          imageData,
          fileName,
          metadata,
        });
        return await res.json();
      } else {
        const res = await apiRequest("POST", `/api/transactions/${transaction.id}/marketing-assets`, {
          type,
          imageData,
          fileName,
          postToSlack,
          metadata,
        });
        return await res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/marketing-assets`] });
      toast({
        title: isEditMode ? "Asset Updated" : "Asset Saved",
        description: isEditMode 
          ? "Marketing asset updated successfully." 
          : (postToSlack ? "Marketing asset saved and posted to Slack." : "Marketing asset saved."),
      });
      onAssetSaved?.();
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
  const allImages = useMemo(() => 
    [...uploadedPhotos, ...propertyImages, ...mlsImages].filter(Boolean),
    [uploadedPhotos, propertyImages, mlsImages]
  );

  const currentImage = allImages[selectedPhotoIndex] || null;
  
  useEffect(() => {
    if (open && isEditMode && initialData) {
      if (initialData.status) {
        const statusValue = STATUS_OPTIONS.find(s => s.value === initialData.status || s.label === initialData.status)?.value;
        if (statusValue) {
          setStatus(statusValue);
        }
      }
      if (initialData.description) {
        setSocialDescription(initialData.description);
      }
      if (initialData.photoUrl) {
        const photoIndex = allImages.findIndex(img => img === initialData.photoUrl);
        if (photoIndex >= 0) {
          setSelectedPhotoIndex(photoIndex);
        }
      }
    }
  }, [open, isEditMode, initialData]);
  
  useEffect(() => {
    if (open && initialFormat) {
      const formatIdMap: Record<string, string> = {
        'square': 'instagram-post',
        'landscape': 'facebook-post',
        'story': 'instagram-story',
      };
      const mappedFormatId = formatIdMap[initialFormat] || initialFormat;
      const format = FORMAT_OPTIONS.find(f => f.id === mappedFormatId);
      if (format) {
        setSelectedFormat(format);
      }
    }
  }, [open, initialFormat]);
  
  useEffect(() => {
    if (open && !isEditMode) {
      const mlsData = transaction.mlsData as any;
      if (mlsData?.status) {
        const mlsStatus = mlsData.status.toLowerCase();
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
    }
  }, [open, isEditMode, transaction.mlsData]);
  
  useEffect(() => {
    if (open && transaction?.id) {
      fetch(`/api/transactions/${transaction.id}/recommended-photos`)
        .then(res => res.json())
        .then(data => {
          const serverRecommendations = data.recommendations || [];
          const offsetRecommendations = serverRecommendations.map((idx: number) => idx + uploadedPhotos.length);
          setRecommendedIndices(offsetRecommendations);
        })
        .catch(() => {
          const firstMlsIndex = uploadedPhotos.length;
          if (allImages.length > firstMlsIndex) {
            setRecommendedIndices([firstMlsIndex]);
          }
        });
    }
  }, [open, transaction?.id, uploadedPhotos.length]);

  useEffect(() => {
    if (!open) {
      setStatus("just_listed");
      setSelectedFormat(FORMAT_OPTIONS[0]);
      setSelectedPhotoIndex(0);
      setGeneratedImage(null);
      setUploadedPhotos([]);
      setSocialDescription("");
      setShowEnlargedPreview(false);
    }
  }, [open]);

  // Format time from 24h to 12h AM/PM
  const formatTime12h = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}${minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : ''} ${period}`;
  };
  
  // Format date to short form (e.g., "SAT JAN 18")
  const formatDateShort = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T12:00:00');
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const getStatusLabel = (statusValue: StatusType) => {
    if (statusValue === 'open_house' && openHouseDate) {
      const dateShort = formatDateShort(openHouseDate);
      const timeStart = formatTime12h(openHouseTimeStart);
      const timeEnd = formatTime12h(openHouseTimeEnd);
      return `OPEN HOUSE | ${dateShort} | ${timeStart.replace(' ', '')}-${timeEnd.replace(' ', '')}`;
    }
    return STATUS_OPTIONS.find(s => s.value === statusValue)?.label?.toUpperCase() || "JUST LISTED";
  };

  const getStatusBadgeColor = (statusValue: StatusType): string => {
    const colors: Record<StatusType, string> = {
      'just_listed': '#f97316',
      'for_sale': '#f97316',
      'for_lease': '#06b6d4',
      'under_contract': '#3b82f6',
      'just_sold': '#ef4444',
      'price_improvement': '#8b5cf6',
      'open_house': '#f97316', // Primary orange to stand out
      'coming_soon': '#14b8a6',
    };
    return colors[statusValue] || '#f97316';
  };

  const formatPrice = (price: number | undefined | null): string => {
    if (!price) return '';
    return `$${price.toLocaleString()}`;
  };

  const parseAddress = (fullAddress: string): { street: string; cityStateZip: string } => {
    const parts = fullAddress.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      return {
        street: parts[0],
        cityStateZip: parts.slice(1).join(', ')
      };
    } else if (parts.length === 2) {
      return {
        street: parts[0],
        cityStateZip: parts[1]
      };
    }
    return { street: fullAddress, cityStateZip: '' };
  };

  const getPropertyPrice = (): number | null => {
    const mlsData = transaction.mlsData as any;
    return transaction.salePrice || transaction.listPrice || mlsData?.listPrice || null;
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
        setSelectedPhotoIndex(0);
        setGeneratedImage(null);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const getProxiedUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith("/") || url.startsWith("data:")) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const hasPropertyData = (): boolean => {
    const mlsData = transaction.mlsData as any;
    return !!(mlsData?.description || transaction.notes || mlsData?.beds || mlsData?.baths);
  };

  const generateAIDescription = async () => {
    if (!hasPropertyData()) {
      toast({
        title: "No Property Data",
        description: "No MLS data available to generate from.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAI(true);

    try {
      const response = await apiRequest("POST", "/api/generate-social-tagline", {
        transactionId: transaction.id,
      });

      const data = await response.json();
      
      if (data.tagline) {
        setSocialDescription(data.tagline);
        setGeneratedImage(null);
        
        toast({
          title: "Tagline Generated",
          description: "Professional broker-style tagline created.",
        });
      }
    } catch (error) {
      console.error("AI description error:", error);
      toast({
        title: "Generation Failed",
        description: "Could not generate tagline. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAutoSelect = () => {
    if (recommendedIndices.length > 0) {
      setSelectedPhotoIndex(recommendedIndices[0]);
    } else if (allImages.length > 0) {
      setSelectedPhotoIndex(0);
    }
    setGeneratedImage(null);
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
      
      const proxiedUrl = getProxiedUrl(currentImage);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = proxiedUrl;
      });

      let generatedDataUrl: string;
      if (selectedFormat.id === 'facebook-post' || selectedFormat.id === 'x-post') {
        generatedDataUrl = await generateLandscapeGraphic(img);
      } else if (selectedFormat.id === 'instagram-story' || selectedFormat.id === 'tiktok-cover') {
        generatedDataUrl = await generateStoryGraphic(img);
      } else {
        generatedDataUrl = await generateSquareGraphic(img);
      }
      
      setGeneratedImage(generatedDataUrl);

      toast({
        title: "Graphic Generated",
        description: `${selectedFormat.fullName} ready to download.`,
      });
    } catch (error) {
      console.error("Error generating graphics:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to load property image. Please try a different photo.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateLandscapeGraphic = async (img: HTMLImageElement): Promise<string> => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    
    canvas.width = 1200;
    canvas.height = 675;

    const headerHeight = 90;
    const price = getPropertyPrice();
    const { street, cityStateZip } = parseAddress(transaction.propertyAddress);

    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, canvas.width, headerHeight);

    try {
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        logo.onload = () => resolve();
        logo.onerror = () => resolve();
        logo.src = spyglassLogoWhite;
      });
      
      if (logo.complete && logo.naturalWidth > 0) {
        const logoHeight = 50;
        const logoWidth = (logo.naturalWidth / logo.naturalHeight) * logoHeight;
        const logoX = 30;
        const logoY = (headerHeight - logoHeight) / 2;
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      }
    } catch (e) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("SPYGLASS REALTY", 30, headerHeight / 2 + 6);
    }

    if (price) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(formatPrice(price), canvas.width - 30, headerHeight / 2 + 10);
    }

    const imageY = headerHeight;
    const imageHeight = canvas.height - headerHeight - 100;
    
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

    const bottomY = canvas.height - 100;
    ctx.fillStyle = "rgba(42, 42, 42, 0.95)";
    ctx.fillRect(0, bottomY, canvas.width, 100);

    const statusLabel = getStatusLabel(status);
    ctx.font = "bold 18px Inter, sans-serif";
    const badgeTextWidth = ctx.measureText(statusLabel).width;
    const badgePadding = 12;
    const badgeHeight = 32;
    const badgeX = 25;
    const badgeY = bottomY + 12;
    
    ctx.fillStyle = getStatusBadgeColor(status);
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeTextWidth + badgePadding * 2, badgeHeight, 4);
    ctx.fill();
    
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText(statusLabel, badgeX + badgePadding, badgeY + 22);

    ctx.font = "bold 20px Inter, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(street, 25, bottomY + 65);

    ctx.font = "16px Inter, sans-serif";
    ctx.fillStyle = "#cccccc";
    const cityLine = socialDescription ? `${cityStateZip} | ${socialDescription}` : cityStateZip;
    ctx.fillText(cityLine, 25, bottomY + 88);

    if (user?.marketingDisplayName) {
      ctx.textAlign = "right";
      ctx.font = "bold 16px Inter, sans-serif";
      ctx.fillText(user.marketingDisplayName, canvas.width - 120, bottomY + 40);
      
      if (user.marketingPhone) {
        ctx.font = "14px Inter, sans-serif";
        ctx.fillText(user.marketingPhone, canvas.width - 120, bottomY + 65);
      }
    }

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
          
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      } catch (e) {}
    }

    return canvas.toDataURL("image/png");
  };

  const generateSquareGraphic = async (img: HTMLImageElement): Promise<string> => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    
    canvas.width = 1080;
    canvas.height = 1080;

    const headerHeight = 100;
    const price = getPropertyPrice();
    const { street, cityStateZip } = parseAddress(transaction.propertyAddress);

    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, canvas.width, headerHeight);

    try {
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => {
        logo.onload = () => resolve();
        logo.onerror = () => resolve();
        logo.src = spyglassLogoWhite;
      });
      
      if (logo.complete && logo.naturalWidth > 0) {
        const logoHeight = 55;
        const logoWidth = (logo.naturalWidth / logo.naturalHeight) * logoHeight;
        const logoX = 30;
        const logoY = (headerHeight - logoHeight) / 2;
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      }
    } catch (e) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("SPYGLASS REALTY", 30, headerHeight / 2 + 8);
    }

    if (price) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 36px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(formatPrice(price), canvas.width - 30, headerHeight / 2 + 12);
    }

    const imageY = headerHeight;
    const imageHeight = canvas.height - headerHeight - 130;
    
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

    const bottomY = canvas.height - 130;
    ctx.fillStyle = "rgba(42, 42, 42, 0.95)";
    ctx.fillRect(0, bottomY, canvas.width, 130);

    const statusLabel = getStatusLabel(status);
    ctx.font = "bold 22px Inter, sans-serif";
    const badgeTextWidth = ctx.measureText(statusLabel).width;
    const badgePadding = 14;
    const badgeHeight = 38;
    const badgeX = 25;
    const badgeY = bottomY + 15;
    
    ctx.fillStyle = getStatusBadgeColor(status);
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeTextWidth + badgePadding * 2, badgeHeight, 4);
    ctx.fill();
    
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText(statusLabel, badgeX + badgePadding, badgeY + 27);

    ctx.font = "bold 24px Inter, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(street, 25, bottomY + 75);

    ctx.font = "18px Inter, sans-serif";
    ctx.fillStyle = "#cccccc";
    const cityLine = socialDescription ? `${cityStateZip} | ${socialDescription}` : cityStateZip;
    ctx.fillText(cityLine.slice(0, 60), 25, bottomY + 105);

    if (user?.marketingDisplayName) {
      ctx.textAlign = "right";
      ctx.font = "bold 18px Inter, sans-serif";
      ctx.fillText(user.marketingDisplayName, canvas.width - 130, bottomY + 50);
      
      if (user.marketingPhone) {
        ctx.font = "16px Inter, sans-serif";
        ctx.fillText(user.marketingPhone, canvas.width - 130, bottomY + 75);
      }
    }

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
          const circleX = canvas.width - 65;
          const circleY = bottomY + 65;
          const circleRadius = 50;
          
          ctx.save();
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          
          const headshotSize = circleRadius * 2;
          ctx.drawImage(headshot, circleX - circleRadius, circleY - circleRadius, headshotSize, headshotSize);
          ctx.restore();
          
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      } catch (e) {}
    }

    return canvas.toDataURL("image/png");
  };

  const generateStoryGraphic = async (img: HTMLImageElement): Promise<string> => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    
    canvas.width = 1080;
    canvas.height = 1920;

    const imgAspect = img.width / img.height;
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
    
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(0,0,0,0.6)");
    gradient.addColorStop(0.25, "rgba(0,0,0,0.1)");
    gradient.addColorStop(0.75, "rgba(0,0,0,0.1)");
    gradient.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
        const logoY = 80;
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      }
    } catch (e) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SPYGLASS REALTY", canvas.width / 2, 120);
    }

    const price = getPropertyPrice();
    if (price) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 72px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(formatPrice(price), canvas.width / 2, 220);
    }

    const { street, cityStateZip } = parseAddress(transaction.propertyAddress);
    
    const bottomY = canvas.height - 350;
    
    const statusLabel = getStatusLabel(status);
    ctx.font = "bold 36px Inter, sans-serif";
    const badgeTextWidth = ctx.measureText(statusLabel).width;
    const badgePadding = 24;
    const badgeHeight = 60;
    const badgeX = (canvas.width - badgeTextWidth - badgePadding * 2) / 2;
    const badgeY = bottomY;
    
    ctx.fillStyle = getStatusBadgeColor(status);
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeTextWidth + badgePadding * 2, badgeHeight, 8);
    ctx.fill();
    
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(statusLabel, canvas.width / 2, badgeY + 43);

    ctx.font = "bold 40px Inter, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(street, canvas.width / 2, bottomY + 110);

    ctx.font = "28px Inter, sans-serif";
    ctx.fillStyle = "#dddddd";
    ctx.fillText(cityStateZip, canvas.width / 2, bottomY + 155);

    if (socialDescription) {
      ctx.font = "italic 26px Inter, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`"${socialDescription}"`, canvas.width / 2, bottomY + 200);
    }

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
          const agentY = canvas.height - 120;
          const circleX = canvas.width / 2 - 100;
          const circleY = agentY;
          const circleRadius = 40;
          
          ctx.save();
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          
          const headshotSize = circleRadius * 2;
          ctx.drawImage(headshot, circleX - circleRadius, circleY - circleRadius, headshotSize, headshotSize);
          ctx.restore();
          
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
          ctx.stroke();
          
          if (user.marketingDisplayName) {
            ctx.textAlign = "left";
            ctx.font = "bold 24px Inter, sans-serif";
            ctx.fillStyle = "#ffffff";
            ctx.fillText(user.marketingDisplayName, circleX + 60, agentY - 8);
            
            if (user.marketingPhone) {
              ctx.font = "20px Inter, sans-serif";
              ctx.fillText(user.marketingPhone, circleX + 60, agentY + 20);
            }
          }
        }
      } catch (e) {}
    } else if (user?.marketingDisplayName) {
      const agentY = canvas.height - 100;
      ctx.textAlign = "center";
      ctx.font = "bold 26px Inter, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(user.marketingDisplayName, canvas.width / 2, agentY);
      
      if (user.marketingPhone) {
        ctx.font = "22px Inter, sans-serif";
        ctx.fillText(user.marketingPhone, canvas.width / 2, agentY + 35);
      }
    }

    return canvas.toDataURL("image/png");
  };

  const downloadImage = async (dataUrl: string, filename: string, formatType: string) => {
    const config: SocialGraphicConfig = {
      status,
      photoUrl: currentImage || undefined,
      description: socialDescription || undefined,
    };
    
    await saveAssetMutation.mutateAsync({
      type: formatType,
      imageData: dataUrl,
      fileName: filename,
      config,
    });

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasGraphicsSettings = user?.marketingDisplayName && user?.marketingPhone;

  const getPreviewAspectClass = () => {
    if (selectedFormat.ratio === '1:1') return "aspect-square";
    if (selectedFormat.ratio === '9:16') return "aspect-[9/16]";
    if (selectedFormat.ratio === '16:9' || selectedFormat.ratio === '1.91:1') return "aspect-video";
    return "aspect-square";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{isEditMode ? 'Edit Marketing Graphic' : 'Create Marketing Graphic'}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update your marketing graphic with new settings.' 
              : `Generate professional marketing graphics for ${transaction.propertyAddress}`}
          </DialogDescription>
        </DialogHeader>

        {!hasGraphicsSettings && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 flex-shrink-0">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Set up your Graphics Settings first to include your headshot, name, and phone on marketing materials.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-6 flex-1 overflow-hidden">
          {/* LEFT COLUMN - Form Inputs */}
          <div className="space-y-4 overflow-y-auto pr-2" data-testid="form-column">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Format</Label>
              <div className="flex flex-wrap gap-1.5">
                {FORMAT_OPTIONS.map((format) => (
                  <Button
                    key={format.id}
                    variant={selectedFormat.id === format.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setSelectedFormat(format); setGeneratedImage(null); }}
                    className="text-xs h-8 px-2.5"
                    data-testid={`button-format-${format.id}`}
                  >
                    <span className="opacity-60 mr-1">{format.ratio}</span>
                    {format.name}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedFormat.width} x {selectedFormat.height}px
              </p>
            </div>

            {/* Photo Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  Select Photo
                  {recommendedIndices.length > 0 && (
                    <span className="text-xs text-primary">
                      {recommendedIndices.length} AI pick{recommendedIndices.length > 1 ? 's' : ''}
                    </span>
                  )}
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoSelect}
                  className="h-7 text-xs gap-1"
                  data-testid="button-auto-select"
                >
                  <Wand2 className="h-3 w-3" />
                  Auto-Select
                </Button>
              </div>
              
              {/* Photo Grid */}
              <div className="grid grid-cols-5 gap-1.5 max-h-28 overflow-y-auto p-1 bg-muted/30 rounded-md">
                {allImages.slice(0, 20).map((photo, index) => {
                  const isRecommended = recommendedIndices.includes(index);
                  const isSelected = selectedPhotoIndex === index;
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedPhotoIndex(index);
                        setGeneratedImage(null);
                      }}
                      className={cn(
                        "relative aspect-square rounded overflow-hidden border-2 transition-all",
                        isSelected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-muted-foreground/40"
                      )}
                      data-testid={`button-photo-thumbnail-${index}`}
                    >
                      <img
                        src={getProxiedUrl(photo)}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      {isSelected && (
                        <div className="absolute top-0.5 left-0.5 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                      {isRecommended && !isSelected && (
                        <div className="absolute top-0.5 right-0.5 bg-primary/90 rounded-full p-0.5">
                          <Sparkles className="h-2 w-2 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {allImages.length} photos • Photo {selectedPhotoIndex + 1} selected
                  {recommendedIndices.includes(selectedPhotoIndex) && (
                    <span className="ml-1 text-primary">(AI pick)</span>
                  )}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-6 text-xs gap-1"
                  data-testid="button-upload-photo"
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
                data-testid="input-photo-upload"
              />
            </div>

            {/* Status Type */}
            <div className="space-y-2">
              <Label>Status Type</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v as StatusType); setGeneratedImage(null); }}>
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

            {/* Open House Date/Time Fields - shown only when Open House is selected */}
            {status === 'open_house' && (
              <div className="space-y-3 p-3 rounded-md bg-orange-500/10 border border-orange-500/20">
                <div className="space-y-2">
                  <Label>Open House Date</Label>
                  <Input
                    type="date"
                    value={openHouseDate}
                    onChange={(e) => { setOpenHouseDate(e.target.value); setGeneratedImage(null); }}
                    data-testid="input-open-house-date"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Select value={openHouseTimeStart} onValueChange={(v) => { setOpenHouseTimeStart(v); setGeneratedImage(null); }}>
                      <SelectTrigger data-testid="select-open-house-start">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((time) => (
                          <SelectItem key={time} value={time}>
                            {formatTime12h(time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Select value={openHouseTimeEnd} onValueChange={(v) => { setOpenHouseTimeEnd(v); setGeneratedImage(null); }}>
                      <SelectTrigger data-testid="select-open-house-end">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'].map((time) => (
                          <SelectItem key={time} value={time}>
                            {formatTime12h(time)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {openHouseDate && (
                  <p className="text-xs text-orange-600 font-medium">
                    Preview: {formatDateShort(openHouseDate)} | {formatTime12h(openHouseTimeStart).replace(' ', '')}-{formatTime12h(openHouseTimeEnd).replace(' ', '')}
                  </p>
                )}
              </div>
            )}

            {/* Social Media Tagline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Social Media Tagline</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generateAIDescription}
                  disabled={isGeneratingAI || !hasPropertyData()}
                  className="h-6 px-2 text-xs gap-1"
                  data-testid="button-ai-generate-description"
                >
                  {isGeneratingAI ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  AI Suggest
                </Button>
              </div>
              <Input
                placeholder={status === 'open_house' 
                  ? "e.g. Join us this Saturday for an Open House!" 
                  : "e.g. Stunning 4BR with Chef's Kitchen"}
                value={socialDescription}
                onChange={(e) => {
                  if (e.target.value.length <= 80) {
                    setSocialDescription(e.target.value);
                    setGeneratedImage(null);
                  }
                }}
                maxLength={80}
                data-testid="input-social-description"
              />
              <p className="text-xs text-muted-foreground text-right">{socialDescription.length}/80 characters</p>
            </div>

            {/* Post to Slack */}
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
                  Post to Slack
                </label>
                <p className="text-xs text-muted-foreground">
                  {transaction.slackChannelId ? "Auto-post when saved" : "No channel connected"}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Live Preview */}
          <div className="flex flex-col space-y-3 overflow-hidden" data-testid="preview-column">
            <Label>Preview</Label>
            <div 
              className={cn(
                "relative bg-muted rounded-lg overflow-hidden flex items-center justify-center flex-1 min-h-0 cursor-pointer group",
                getPreviewAspectClass(),
                "max-h-[55vh]"
              )}
              onClick={() => (generatedImage || currentImage) && setShowEnlargedPreview(true)}
              data-testid="preview-container"
            >
              {generatedImage ? (
                <>
                  <img
                    src={generatedImage}
                    alt="Generated preview"
                    className="w-full h-full object-contain"
                    data-testid="img-generated-preview"
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
                      data-testid="img-selected-photo"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
                    <div className="absolute top-4 left-0 right-0 text-center">
                      <p className="text-white/80 text-xs font-medium">SPYGLASS REALTY</p>
                      {getPropertyPrice() && (
                        <p className="text-white text-xl font-bold mt-1">
                          {formatPrice(getPropertyPrice())}
                        </p>
                      )}
                    </div>
                    <div className="absolute bottom-4 left-0 right-0 text-center px-4">
                      <span 
                        className="inline-block px-3 py-1 rounded text-xs font-semibold uppercase text-white"
                        style={{ backgroundColor: getStatusBadgeColor(status) }}
                      >
                        {getStatusLabel(status)}
                      </span>
                      <p className="text-white text-sm font-medium mt-2 truncate">
                        {parseAddress(transaction.propertyAddress).street}
                      </p>
                      {socialDescription && (
                        <p className="text-white/80 text-xs mt-1 truncate">{socialDescription}</p>
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
              {generatedImage ? "Click to enlarge" : "Live preview - click Generate to create final graphic"}
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              {generatedImage ? (
                <Button
                  onClick={() => {
                    const formatType = selectedFormat.id.includes('facebook') ? 'facebook' : 
                                      selectedFormat.id.includes('story') || selectedFormat.id.includes('tiktok') ? 'story' : 
                                      selectedFormat.id.includes('x-post') ? 'x' : 'instagram';
                    downloadImage(
                      generatedImage, 
                      `${transaction.propertyAddress.replace(/[^a-z0-9]/gi, "_")}_${selectedFormat.id}.png`, 
                      formatType
                    );
                  }}
                  disabled={saveAssetMutation.isPending}
                  className="flex-1"
                  data-testid="button-download-generated"
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
                  onClick={generateGraphics}
                  disabled={isGenerating || !currentImage}
                  className="flex-1"
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
                      Generate Graphic
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Enlarged Preview Modal */}
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
              data-testid="button-close-enlarged"
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
