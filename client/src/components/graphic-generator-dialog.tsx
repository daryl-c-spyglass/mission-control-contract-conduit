import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Upload, Check, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
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

const getStatusLabel = (statusValue: StatusType) => {
  return STATUS_OPTIONS.find(s => s.value === statusValue)?.label || "Just Listed";
};

type TemplateId = "navy_header" | "two_photo_white" | "single_minimal" | "photo_info_below";

interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  photoCount: 1 | 2;
}

const TEMPLATES: TemplateDefinition[] = [
  { id: "navy_header", name: "Navy Header", description: "Dark navy header with status & address, large photo, white stats footer", photoCount: 1 },
  { id: "two_photo_white", name: "Two Photo", description: "White background, status & price in header, two side-by-side photos, stats bar", photoCount: 2 },
  { id: "single_minimal", name: "Clean Minimal", description: "Logo & status header, single large photo, stats footer with colored dividers", photoCount: 1 },
  { id: "photo_info_below", name: "Photo + Info", description: "Large photo with logos, status & property details below on white", photoCount: 1 },
];

function formatPrice(value: string | number | null | undefined): string {
  if (!value) return "";
  const num = typeof value === "string" ? parseFloat(value.replace(/[^0-9.]/g, "")) : value;
  if (isNaN(num)) return "";
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatNumber(value: string | number | null | undefined): string {
  if (!value && value !== 0) return "";
  const num = typeof value === "string" ? parseFloat(value.replace(/[^0-9.]/g, "")) : value;
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US");
}

function TemplateThumbnail({ templateId }: { templateId: TemplateId }) {
  const w = 48;
  const h = 60;
  switch (templateId) {
    case "navy_header":
      return (
        <svg width={w} height={h} viewBox="0 0 48 60" className="rounded-sm">
          <rect width="48" height="60" fill="#f3f3f3" />
          <rect width="48" height="10" fill="#0f1b3d" />
          <rect x="3" y="2.5" width="18" height="2.5" rx="0.5" fill="#fff" opacity="0.9" />
          <rect x="3" y="6" width="12" height="1.5" rx="0.5" fill="#fff" opacity="0.5" />
          <rect x="0" y="11" width="48" height="36" fill="#a0aec0" />
          <rect x="0" y="48" width="48" height="12" fill="#fff" />
          <rect x="4" y="51" width="8" height="2.5" rx="0.5" fill="#333" />
          <rect x="16" y="51" width="8" height="2.5" rx="0.5" fill="#333" />
          <rect x="28" y="51" width="8" height="2.5" rx="0.5" fill="#333" />
          <rect x="40" y="51" width="5" height="2.5" rx="0.5" fill="#333" />
          <line x1="13" y1="49" x2="13" y2="57" stroke="#e84393" strokeWidth="0.7" />
          <line x1="25" y1="49" x2="25" y2="57" stroke="#e84393" strokeWidth="0.7" />
          <line x1="37" y1="49" x2="37" y2="57" stroke="#e84393" strokeWidth="0.7" />
        </svg>
      );
    case "two_photo_white":
      return (
        <svg width={w} height={h} viewBox="0 0 48 60" className="rounded-sm">
          <rect width="48" height="60" fill="#fff" />
          <rect x="3" y="3" width="20" height="4" rx="0.5" fill="#111" />
          <rect x="3" y="8" width="14" height="1.5" rx="0.5" fill="#888" />
          <rect x="3" y="11" width="10" height="2.5" rx="0.5" fill="#333" />
          <rect x="0" y="16" width="23" height="32" fill="#a0aec0" rx="1" />
          <rect x="25" y="16" width="23" height="32" fill="#90cdf4" rx="1" />
          <rect x="4" y="51" width="10" height="2.5" rx="0.5" fill="#333" />
          <rect x="18" y="51" width="10" height="2.5" rx="0.5" fill="#333" />
          <rect x="32" y="51" width="10" height="2.5" rx="0.5" fill="#333" />
        </svg>
      );
    case "single_minimal":
      return (
        <svg width={w} height={h} viewBox="0 0 48 60" className="rounded-sm">
          <rect width="48" height="60" fill="#f8f8f8" />
          <rect x="3" y="3" width="7" height="5" rx="0.5" fill="#ddd" stroke="#ccc" strokeWidth="0.4" />
          <rect x="12" y="3" width="16" height="3" rx="0.5" fill="#111" />
          <rect x="12" y="7" width="10" height="1.5" rx="0.5" fill="#888" />
          <rect x="4" y="11" width="40" height="36" fill="#a0aec0" rx="1" />
          <rect x="0" y="48" width="48" height="12" fill="#fff" />
          <rect x="4" y="51" width="7" height="2" rx="0.5" fill="#333" />
          <rect x="14" y="51" width="7" height="2" rx="0.5" fill="#333" />
          <rect x="25" y="51" width="7" height="2" rx="0.5" fill="#333" />
          <rect x="36" y="51" width="7" height="2" rx="0.5" fill="#333" />
          <line x1="12" y1="49" x2="12" y2="57" stroke="#00bcd4" strokeWidth="0.7" />
          <line x1="23" y1="49" x2="23" y2="57" stroke="#00bcd4" strokeWidth="0.7" />
          <line x1="34" y1="49" x2="34" y2="57" stroke="#00bcd4" strokeWidth="0.7" />
        </svg>
      );
    case "photo_info_below":
      return (
        <svg width={w} height={h} viewBox="0 0 48 60" className="rounded-sm">
          <rect width="48" height="60" fill="#fff" />
          <rect x="0" y="0" width="48" height="36" fill="#a0aec0" />
          <rect x="3" y="29" width="18" height="5" rx="0.5" fill="#fff" opacity="0.85" />
          <rect x="3" y="39" width="22" height="3" rx="0.5" fill="#111" />
          <rect x="3" y="44" width="7" height="1.5" rx="0.5" fill="#888" />
          <rect x="12" y="44" width="12" height="1.5" rx="0.5" fill="#333" />
          <rect x="28" y="44" width="5" height="1.5" rx="0.5" fill="#888" />
          <rect x="35" y="44" width="9" height="1.5" rx="0.5" fill="#333" />
          <line x1="3" y1="49" x2="45" y2="49" stroke="#eee" strokeWidth="0.4" />
          <rect x="3" y="52" width="7" height="2" rx="0.5" fill="#333" />
          <rect x="16" y="52" width="7" height="2" rx="0.5" fill="#333" />
          <rect x="30" y="52" width="7" height="2" rx="0.5" fill="#333" />
        </svg>
      );
  }
}

export function GraphicGeneratorDialog({
  open,
  onOpenChange,
  transaction,
}: GraphicGeneratorDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("navy_header");
  const [status, setStatus] = useState<StatusType>("just_listed");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedPhoto2Index, setSelectedPhoto2Index] = useState(1);
  const [photoSlotTarget, setPhotoSlotTarget] = useState<1 | 2>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [showEnlargedPreview, setShowEnlargedPreview] = useState(false);
  const [addressOverride, setAddressOverride] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [bedsOverride, setBedsOverride] = useState("");
  const [bathsOverride, setBathsOverride] = useState("");
  const [sqftOverride, setSqftOverride] = useState("");
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);

  const { data: agentProfileData } = useQuery<{ profile: AgentProfile | null; user: any }>({
    queryKey: ["/api/agent/profile"],
    staleTime: 0,
    refetchOnMount: true,
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

  const safePhotoIndex = Math.min(selectedPhotoIndex, Math.max(0, allImages.length - 1));
  const safePhoto2Index = Math.min(selectedPhoto2Index, Math.max(0, allImages.length - 1));
  const currentImage = allImages[safePhotoIndex] || null;
  const currentImage2 = allImages.length > 1 ? (allImages[safePhoto2Index !== safePhotoIndex ? safePhoto2Index : ((safePhotoIndex + 1) % allImages.length)] || null) : currentImage;

  const extractedPrice = useMemo(() => {
    if (priceOverride) return priceOverride;
    const raw = (transaction as any).listPrice || mlsData?.listPrice || mlsData?.price || mlsData?.ListPrice || "";
    return formatPrice(raw);
  }, [priceOverride, transaction, mlsData]);

  const extractedBeds = useMemo(() => {
    if (bedsOverride) return bedsOverride;
    const raw = mlsData?.beds ?? mlsData?.bedrooms ?? mlsData?.bedroomsTotal ?? mlsData?.BedroomsTotal ?? "";
    return String(raw || "");
  }, [bedsOverride, mlsData]);

  const extractedBaths = useMemo(() => {
    if (bathsOverride) return bathsOverride;
    const raw = mlsData?.baths ?? mlsData?.bathrooms ?? mlsData?.bathroomsTotalInteger ?? mlsData?.BathroomsTotalInteger ?? "";
    return String(raw || "");
  }, [bathsOverride, mlsData]);

  const extractedSqft = useMemo(() => {
    if (sqftOverride) return sqftOverride;
    const raw = mlsData?.sqft ?? mlsData?.livingArea ?? mlsData?.LivingArea ?? "";
    return formatNumber(raw);
  }, [sqftOverride, mlsData]);

  const displayAddress = useMemo(() => {
    return addressOverride || transaction.propertyAddress || "";
  }, [addressOverride, transaction.propertyAddress]);

  useEffect(() => {
    if (open) {
      setGeneratedImage(null);
      setShowEnlargedPreview(false);
      setAddressOverride("");
      setPriceOverride("");
      setBedsOverride("");
      setBathsOverride("");
      setSqftOverride("");
      setPreviewDataUrl(null);
      setSelectedPhotoIndex(0);
      setSelectedPhoto2Index(Math.min(1, allImages.length - 1));

      const mlsStatus = (mlsData?.status || transaction.status || "").toLowerCase();
      let detectedStatus: StatusType = "just_listed";
      if (mlsStatus.includes("contract") || mlsStatus.includes("pending")) detectedStatus = "under_contract";
      else if (mlsStatus.includes("sold") || mlsStatus.includes("closed")) detectedStatus = "just_sold";
      else if (mlsStatus.includes("lease")) detectedStatus = "for_lease";
      else if (mlsStatus.includes("coming")) detectedStatus = "coming_soon";
      else if (mlsStatus.includes("active")) {
        const dom = mlsData?.simpleDaysOnMarket || mlsData?.daysOnMarket || 0;
        detectedStatus = dom <= 7 ? "just_listed" : "for_sale";
      }
      setStatus(detectedStatus);
    }
  }, [open, mlsData, transaction.status, allImages.length]);

  useEffect(() => {
    if (!open) {
      setUploadedPhotos([]);
      setSelectedPhotoIndex(0);
      setSelectedPhoto2Index(1);
      setGeneratedImage(null);
      setShowEnlargedPreview(false);
      setPreviewDataUrl(null);
    }
  }, [open]);

  const saveAssetMutation = useMutation({
    mutationFn: async ({ imageData, fileName }: { imageData: string; fileName: string }) => {
      const res = await apiRequest("POST", `/api/transactions/${transaction.id}/marketing-assets`, {
        type: "graphic-generator",
        imageData,
        fileName,
        postToSlack: true,
        metadata: { config: { status, template: selectedTemplate, photoUrl: currentImage } },
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

  const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const imgAspect = img.width / img.height;
    const boxAspect = w / h;
    let sx, sy, sw, sh;
    if (imgAspect > boxAspect) {
      sh = img.height;
      sw = img.height * boxAspect;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = img.width / boxAspect;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  };

  const getLogoSources = () => {
    const useDefaultCompany = marketingProfile?.companyLogoUseDefault !== false;
    const useDefaultSecondary = marketingProfile?.secondaryLogoUseDefault !== false;
    const companyLogo = useDefaultCompany
      ? "/logos/SpyglassRealty_Logo_Black.png"
      : (marketingProfile?.companyLogo || "/logos/SpyglassRealty_Logo_Black.png");
    const companyLogoWhite = useDefaultCompany
      ? "/logos/SpyglassRealty_Logo_White.png"
      : (marketingProfile?.companyLogo || "/logos/SpyglassRealty_Logo_White.png");
    const secondaryLogo = useDefaultSecondary
      ? "/logos/LeadingRE_Black.png"
      : (marketingProfile?.secondaryLogo || "/logos/LeadingRE_Black.png");
    const secondaryLogoWhite = useDefaultSecondary
      ? "/logos/LeadingRE_White.png"
      : (marketingProfile?.secondaryLogo || "/logos/LeadingRE_White.png");
    return { companyLogo, companyLogoWhite, secondaryLogo, secondaryLogoWhite };
  };

  const drawLogo = async (ctx: CanvasRenderingContext2D, src: string, x: number, y: number, maxH: number, align: "left" | "right" = "left") => {
    const logo = await loadImageSafe(src);
    if (!logo || !logo.naturalWidth) return 0;
    const ratio = logo.naturalWidth / logo.naturalHeight;
    const h = maxH;
    const w = h * ratio;
    const drawX = align === "right" ? x - w : x;
    ctx.drawImage(logo, drawX, y, w, h);
    return w;
  };

  const renderNavyHeaderTemplate = async (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const s = w / 1080;
    const navyColor = "#0f1b3d";
    const pinkAccent = "#e84393";

    ctx.fillStyle = navyColor;
    ctx.fillRect(0, 0, w, 160 * s);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${42 * s}px Inter, Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(getStatusLabel(status), 50 * s, 60 * s);

    ctx.font = `${20 * s}px Inter, Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(displayAddress, 50 * s, 110 * s);

    const logos = getLogoSources();
    await drawLogo(ctx, logos.companyLogoWhite, w - 50 * s, 40 * s, 55 * s, "right");

    const photoY = 160 * s;
    const photoH = h - 160 * s - 180 * s;
    if (currentImage) {
      const img = await loadImageSafe(currentImage);
      if (img) drawImageCover(ctx, img, 0, photoY, w, photoH);
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, h - 180 * s, w, 180 * s);

    const statsY = h - 120 * s;
    const statsBaseline = statsY + 30 * s;
    const colWidth = w / 4;

    const statsData = [
      { value: extractedSqft, label: "SQF" },
      { value: extractedPrice, label: "Price" },
      { value: extractedBeds, label: "Beds" },
      { value: extractedBaths, label: "Baths" },
    ];

    statsData.forEach((stat, i) => {
      const cx = colWidth * i + colWidth / 2;
      ctx.fillStyle = "#111111";
      ctx.font = `bold ${32 * s}px Inter, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(stat.value || "0", cx, statsBaseline);

      ctx.fillStyle = "#666666";
      ctx.font = `${18 * s}px Inter, Arial, sans-serif`;
      ctx.fillText(stat.label, cx, statsBaseline + 32 * s);

      if (i < statsData.length - 1) {
        ctx.strokeStyle = pinkAccent;
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(colWidth * (i + 1), statsY - 10 * s);
        ctx.lineTo(colWidth * (i + 1), statsBaseline + 50 * s);
        ctx.stroke();
      }
    });
  };

  const renderTwoPhotoWhiteTemplate = async (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const s = w / 1080;
    const pinkAccent = "#f06292";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#111111";
    ctx.font = `bold ${48 * s}px Inter, Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(getStatusLabel(status), 50 * s, 45 * s);

    ctx.font = `${20 * s}px Inter, Arial, sans-serif`;
    ctx.fillStyle = "#555555";
    ctx.fillText(displayAddress, 50 * s, 105 * s);

    ctx.font = `bold ${34 * s}px Inter, Arial, sans-serif`;
    ctx.fillStyle = "#111111";
    ctx.fillText(extractedPrice || "$0,000,000", 50 * s, 140 * s);

    const logos = getLogoSources();
    await drawLogo(ctx, logos.companyLogo, w - 50 * s, 45 * s, 50 * s, "right");

    ctx.strokeStyle = pinkAccent;
    ctx.lineWidth = 2 * s;
    const logoBoxX = w - 140 * s;
    ctx.beginPath();
    ctx.moveTo(logoBoxX, 35 * s);
    ctx.lineTo(logoBoxX + 3 * s, 35 * s);
    ctx.lineTo(logoBoxX + 3 * s, 100 * s);
    ctx.stroke();

    const photoY = 200 * s;
    const photoH = h - 200 * s - 180 * s;
    const gap = 8 * s;
    const photoW = (w - gap) / 2;

    if (currentImage) {
      const img = await loadImageSafe(currentImage);
      if (img) drawImageCover(ctx, img, 0, photoY, photoW, photoH);
    }
    if (currentImage2) {
      const img2 = await loadImageSafe(currentImage2);
      if (img2) drawImageCover(ctx, img2, photoW + gap, photoY, photoW, photoH);
    }

    const statsY = h - 160 * s;
    const statsBaseline = statsY + 40 * s;
    const colWidth = w / 3;

    const statsData = [
      { value: extractedSqft, label: "SQF" },
      { value: extractedBeds, label: "Beds" },
      { value: extractedBaths, label: "Baths" },
    ];

    statsData.forEach((stat, i) => {
      const cx = colWidth * i + colWidth / 2;
      ctx.fillStyle = "#111111";
      ctx.font = `bold ${36 * s}px Inter, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(stat.value || "0", cx - 20 * s, statsBaseline);

      ctx.fillStyle = "#666666";
      ctx.font = `${20 * s}px Inter, Arial, sans-serif`;
      ctx.fillText(stat.label, cx + 40 * s, statsBaseline);

      if (i < statsData.length - 1) {
        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(colWidth * (i + 1), statsY + 15 * s);
        ctx.lineTo(colWidth * (i + 1), statsBaseline + 25 * s);
        ctx.stroke();
      }
    });
  };

  const renderSingleMinimalTemplate = async (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const s = w / 1080;
    const tealAccent = "#00bcd4";

    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(0, 0, w, h);

    const logos = getLogoSources();
    const logoW = await drawLogo(ctx, logos.companyLogo, 50 * s, 38 * s, 45 * s, "left");

    ctx.fillStyle = "#111111";
    ctx.font = `bold ${36 * s}px Inter, Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const textStartX = 50 * s + logoW + 30 * s;
    ctx.fillText(getStatusLabel(status), textStartX, 45 * s);

    ctx.font = `${18 * s}px Inter, Arial, sans-serif`;
    ctx.fillStyle = "#666666";
    ctx.fillText(displayAddress, textStartX, 78 * s);

    const photoY = 115 * s;
    const photoH = h - 115 * s - 180 * s;
    const photoPad = 40 * s;

    if (currentImage) {
      const img = await loadImageSafe(currentImage);
      if (img) drawImageCover(ctx, img, photoPad, photoY, w - photoPad * 2, photoH);
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, h - 170 * s, w, 170 * s);

    const statsY = h - 130 * s;
    const statsBaseline = statsY + 15 * s;
    const colWidth = w / 4;

    const statsData = [
      { label: "Price", value: extractedPrice },
      { label: "SQF", value: extractedSqft },
      { label: "Beds", value: extractedBeds },
      { label: "Baths", value: extractedBaths },
    ];

    statsData.forEach((stat, i) => {
      const cx = colWidth * i + colWidth / 2;

      ctx.fillStyle = "#888888";
      ctx.font = `${16 * s}px Inter, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(stat.label, cx, statsBaseline);

      ctx.fillStyle = "#111111";
      ctx.font = `bold ${26 * s}px Inter, Arial, sans-serif`;
      ctx.fillText(stat.value || "0", cx, statsBaseline + 38 * s);

      if (i < statsData.length - 1) {
        ctx.strokeStyle = tealAccent;
        ctx.lineWidth = 2.5 * s;
        ctx.beginPath();
        ctx.moveTo(colWidth * (i + 1), statsY - 5 * s);
        ctx.lineTo(colWidth * (i + 1), statsBaseline + 55 * s);
        ctx.stroke();
      }
    });
  };

  const renderPhotoInfoBelowTemplate = async (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const s = w / 1080;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const photoH = h * 0.6;
    if (currentImage) {
      const img = await loadImageSafe(currentImage);
      if (img) drawImageCover(ctx, img, 0, 0, w, photoH);
    }

    const logos = getLogoSources();
    const logoBgH = 55 * s;
    const logoBgY = photoH - logoBgH - 25 * s;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.roundRect(40 * s, logoBgY, 300 * s, logoBgH, 4 * s);
    ctx.fill();

    await drawLogo(ctx, logos.companyLogo, 55 * s, logoBgY + 10 * s, 35 * s, "left");

    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(55 * s + 120 * s, logoBgY + 8 * s);
    ctx.lineTo(55 * s + 120 * s, logoBgY + logoBgH - 8 * s);
    ctx.stroke();

    await drawLogo(ctx, logos.secondaryLogo, 55 * s + 135 * s, logoBgY + 10 * s, 35 * s, "left");

    const infoY = photoH + 30 * s;

    ctx.fillStyle = "#111111";
    ctx.font = `300 ${42 * s}px Inter, Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(getStatusLabel(status), 50 * s, infoY);

    const parts = displayAddress.split(",").map(p => p.trim());
    const street = parts[0] || "";
    const cityState = parts.slice(1).join(", ");

    const detailY = infoY + 70 * s;

    ctx.fillStyle = "#888888";
    ctx.font = `${16 * s}px Inter, Arial, sans-serif`;
    ctx.fillText("Address", 50 * s, detailY);

    ctx.fillStyle = "#333333";
    ctx.font = `${20 * s}px Inter, Arial, sans-serif`;
    ctx.fillText(street, 170 * s, detailY);
    if (cityState) {
      ctx.fillText(cityState, 170 * s, detailY + 28 * s);
    }

    ctx.fillStyle = "#888888";
    ctx.font = `${16 * s}px Inter, Arial, sans-serif`;
    ctx.fillText("Price", w * 0.55, detailY);

    ctx.fillStyle = "#333333";
    ctx.font = `${20 * s}px Inter, Arial, sans-serif`;
    ctx.fillText(extractedPrice || "$0,000,000", w * 0.55 + 70 * s, detailY);

    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(50 * s, detailY + 72 * s);
    ctx.lineTo(w - 50 * s, detailY + 72 * s);
    ctx.stroke();

    const statsY2 = detailY + 95 * s;
    const col3 = (w - 100 * s) / 3;

    const statsData = [
      { label: "SQF", value: extractedSqft },
      { label: "Beds", value: extractedBeds },
      { label: "Baths", value: extractedBaths },
    ];

    statsData.forEach((stat, i) => {
      const x = 50 * s + col3 * i;
      ctx.fillStyle = "#888888";
      ctx.font = `${16 * s}px Inter, Arial, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(stat.label, x, statsY2);

      ctx.fillStyle = "#111111";
      ctx.font = `bold ${24 * s}px Inter, Arial, sans-serif`;
      ctx.fillText(stat.value || "0", x + 70 * s, statsY2);
    });
  };

  const renderCanvas = useCallback(async (canvasWidth: number = 1080): Promise<string | null> => {
    if (!currentImage && !currentImage2) return null;

    const canvasHeight = Math.round(canvasWidth * 1350 / 1080);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    try {
      switch (selectedTemplate) {
        case "navy_header":
          await renderNavyHeaderTemplate(ctx, canvasWidth, canvasHeight);
          break;
        case "two_photo_white":
          await renderTwoPhotoWhiteTemplate(ctx, canvasWidth, canvasHeight);
          break;
        case "single_minimal":
          await renderSingleMinimalTemplate(ctx, canvasWidth, canvasHeight);
          break;
        case "photo_info_below":
          await renderPhotoInfoBelowTemplate(ctx, canvasWidth, canvasHeight);
          break;
      }
      return canvas.toDataURL("image/png");
    } catch (err) {
      console.error("Canvas render error:", err);
      return null;
    }
  }, [currentImage, currentImage2, selectedTemplate, status, displayAddress, extractedPrice, extractedBeds, extractedBaths, extractedSqft, marketingProfile]);

  useEffect(() => {
    if (!open || (!currentImage && !currentImage2)) {
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
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [open, currentImage, currentImage2, selectedTemplate, status, displayAddress, extractedPrice, extractedBeds, extractedBaths, extractedSqft, marketingProfile, renderCanvas]);

  const handleDownload = async () => {
    if (!currentImage && !currentImage2) {
      toast({ title: "No Image", description: "Select a property photo first.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const dataUrl = await renderCanvas(1080);
      if (dataUrl) {
        setGeneratedImage(dataUrl);
        const fileName = `${transaction.propertyAddress.replace(/[^a-z0-9]/gi, "_")}_${selectedTemplate}.png`;
        await saveAssetMutation.mutateAsync({ imageData: dataUrl, fileName });

        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error generating graphic:", error);
      toast({ title: "Generation Failed", description: "Failed to generate. Try a different photo.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const currentTemplateDef = TEMPLATES.find(t => t.id === selectedTemplate)!;
  const previewImage = generatedImage || previewDataUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-base sm:text-lg" data-testid="text-graphic-title">Graphic Generator</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Create professional social media graphics for {transaction.propertyAddress}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-5 flex-1 overflow-hidden">
          <div className="space-y-4 overflow-y-auto pr-2" data-testid="graphic-form-column">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Choose Template</Label>
              <div className="grid grid-cols-4 gap-2">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => { setSelectedTemplate(tmpl.id); setGeneratedImage(null); }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2 rounded-md border-2 transition-all",
                      selectedTemplate === tmpl.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/40"
                    )}
                    data-testid={`button-template-${tmpl.id}`}
                  >
                    <TemplateThumbnail templateId={tmpl.id} />
                    <p className="text-[10px] font-medium text-center leading-tight">{tmpl.name}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {currentTemplateDef.photoCount === 2 ? "Select Photos (2)" : "Select Photo"}
              </Label>
              {currentTemplateDef.photoCount === 2 && (
                <div className="flex gap-1 mb-1">
                  <Button
                    variant={photoSlotTarget === 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPhotoSlotTarget(1)}
                    data-testid="button-photo-slot-1"
                  >
                    Photo 1 (Left)
                  </Button>
                  <Button
                    variant={photoSlotTarget === 2 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPhotoSlotTarget(2)}
                    data-testid="button-photo-slot-2"
                  >
                    Photo 2 (Right)
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-6 gap-1 max-h-24 overflow-y-auto p-1 bg-muted/30 rounded-md">
                {allImages.slice(0, 30).map((photo, index) => {
                  const isPhoto1 = selectedPhotoIndex === index;
                  const isPhoto2 = currentTemplateDef.photoCount === 2 && selectedPhoto2Index === index;
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        if (currentTemplateDef.photoCount === 2) {
                          if (photoSlotTarget === 1) {
                            if (index !== selectedPhoto2Index) {
                              setSelectedPhotoIndex(index);
                            }
                          } else {
                            if (index !== selectedPhotoIndex) {
                              setSelectedPhoto2Index(index);
                            }
                          }
                        } else {
                          setSelectedPhotoIndex(index);
                        }
                        setGeneratedImage(null);
                      }}
                      className={cn(
                        "relative aspect-square rounded overflow-hidden border-2 transition-all",
                        isPhoto1 ? "border-primary ring-2 ring-primary/30" :
                        isPhoto2 ? "border-blue-400 ring-2 ring-blue-400/30" :
                        "border-transparent hover:border-muted-foreground/40"
                      )}
                      data-testid={`button-graphic-photo-${index}`}
                    >
                      <img
                        src={getProxiedUrl(photo)}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      {(isPhoto1 || isPhoto2) && (
                        <div className={cn(
                          "absolute top-0 left-0 text-white text-[9px] font-bold px-1 rounded-br",
                          isPhoto1 ? "bg-primary" : "bg-blue-400"
                        )}>
                          {isPhoto1 ? "1" : "2"}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between flex-wrap gap-1">
                <p className="text-[11px] text-muted-foreground">{allImages.length} photos</p>
                <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-graphic-upload">
                  <Upload className="h-3 w-3 mr-1" /> Upload
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} data-testid="input-graphic-photo-upload" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</Label>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Address</Label>
                <Input
                  placeholder={transaction.propertyAddress}
                  value={addressOverride}
                  onChange={(e) => { setAddressOverride(e.target.value); setGeneratedImage(null); }}
                  className="text-xs"
                  data-testid="input-graphic-address"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Price</Label>
                <Input
                  placeholder={extractedPrice || "$0,000,000"}
                  value={priceOverride}
                  onChange={(e) => { setPriceOverride(e.target.value); setGeneratedImage(null); }}
                  className="text-xs"
                  data-testid="input-graphic-price"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Beds</Label>
                <Input
                  placeholder={extractedBeds || "0"}
                  value={bedsOverride}
                  onChange={(e) => { setBedsOverride(e.target.value); setGeneratedImage(null); }}
                  className="text-xs"
                  data-testid="input-graphic-beds"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Baths</Label>
                <Input
                  placeholder={extractedBaths || "0"}
                  value={bathsOverride}
                  onChange={(e) => { setBathsOverride(e.target.value); setGeneratedImage(null); }}
                  className="text-xs"
                  data-testid="input-graphic-baths"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Sqft</Label>
                <Input
                  placeholder={extractedSqft || "0"}
                  value={sqftOverride}
                  onChange={(e) => { setSqftOverride(e.target.value); setGeneratedImage(null); }}
                  className="text-xs"
                  data-testid="input-graphic-sqft"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-2 overflow-hidden" data-testid="graphic-preview-column">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Live Preview
                <span className="text-muted-foreground/60 font-normal normal-case ml-1">(1080 x 1080px)</span>
              </Label>
              {isRenderingPreview && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
            <div
              className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center flex-1 min-h-0 cursor-pointer group aspect-[4/5] max-h-[58vh]"
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
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                    <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground p-6">
                  <Upload className="h-8 w-8 opacity-50" />
                  <p className="text-sm">Select a photo to see preview</p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground text-center">Click preview to enlarge</p>
          </div>
        </div>

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
