import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapboxPropertyMap } from "./mapbox-property-map";
import { useTheme } from "@/hooks/use-theme";
import { getDisplayDOM, hasAccurateDOM } from "@shared/lib/listings";
import {
  ArrowLeft,
  Calendar,
  Home,
  Hash,
  Users,
  MessageSquare,
  Mail,
  ExternalLink,
  Phone,
  MapPin,
  Bed,
  Bath,
  Square,
  Clock,
  Activity,
  FileText,
  User,
  Loader2,
  RefreshCw,
  Image as ImageIcon,
  FileImage,
  Download,
  Trash2,
  Upload,
  File,
  Search,
  Layout,
  Smartphone,
  Newspaper,
  CreditCard,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Building,
  DollarSign,
  Share2,
  X,
  Flame,
  Car,
  Trees,
  Sofa,
  ChefHat,
  BedDouble,
  Maximize2,
  Grid3X3,
  Waves,
  Eye,
  Pencil,
  TrendingDown,
  TrendingUp,
  Video,
  Info,
  RotateCcw,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateFlyerDialog, FlyerAssetConfig } from "./create-flyer-dialog";
import { MarketingMaterialsDialog, SocialGraphicConfig } from "./marketing-materials-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getStatusBadgeStyle, getStatusLabel } from "@/lib/utils/status-colors";
import type { Transaction, Coordinator, Activity as ActivityType, CMAComparable, MLSData, MarketingAsset, ContractDocument } from "@shared/schema";

interface TransactionDetailsProps {
  transaction: Transaction;
  coordinators: Coordinator[];
  activities: ActivityType[];
  onBack: () => void;
  initialTab?: string;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDateTime(dateString: Date | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Collapsible feature section component for MLS features
function FeatureSection({ title, items, defaultOpen = false }: { title: string; items: string[]; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  if (!items || items.length === 0) return null;
  
  return (
    <div className="border-b border-border last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-3 flex items-center justify-between gap-2 text-left hover-elevate rounded-md px-2 -mx-2"
        data-testid={`button-toggle-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className="font-medium text-foreground">{title}</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="pb-3 flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span key={i} className="px-3 py-1 bg-muted text-muted-foreground text-sm rounded-full">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Document type options
type DocumentType = 'contract' | 'amendment' | 'addendum' | 'disclosure' | 'inspection' | 'appraisal' | 'other';

const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'contract', label: 'Contract' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'addendum', label: 'Addendum' },
  { value: 'disclosure', label: 'Disclosure' },
  { value: 'inspection', label: 'Inspection Report' },
  { value: 'appraisal', label: 'Appraisal' },
  { value: 'other', label: 'Other' },
];

const DOCUMENT_TYPE_COLORS: Record<DocumentType, string> = {
  contract: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  amendment: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  addendum: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  disclosure: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  inspection: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  appraisal: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

interface DocumentUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (data: { name: string; documentType: DocumentType; file: File; notes?: string }) => void;
  isUploading: boolean;
}

function DocumentUploadDialog({ isOpen, onClose, onUpload, isUploading }: DocumentUploadDialogProps) {
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('contract');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const canSubmit = name.trim() !== '' && file !== null;

  const handleSubmit = () => {
    setShowValidation(true);
    if (!canSubmit) return;
    onUpload({ name: name.trim(), documentType, file, notes: notes.trim() || undefined });
  };

  const resetForm = () => {
    setName('');
    setDocumentType('contract');
    setFile(null);
    setNotes('');
    setShowValidation(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-name">Document Name *</Label>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales Contract, Amendment #1"
              className={showValidation && !name.trim() ? 'border-destructive' : ''}
              data-testid="input-document-name"
            />
            {showValidation && !name.trim() && (
              <p className="text-sm text-destructive">Please enter a document name</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
              <SelectTrigger data-testid="select-document-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>File *</Label>
            {file ? (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors ${showValidation && !file ? 'border-destructive' : ''}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
                  data-testid="input-document-file"
                />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to select a file
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, PNG
                </p>
              </div>
            )}
            {showValidation && !file && (
              <p className="text-sm text-destructive">Please select a file to upload</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-notes">Notes (optional)</Label>
            <Textarea
              id="doc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this document..."
              rows={2}
              data-testid="input-document-notes"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isUploading} data-testid="button-submit-upload">
            {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Upload Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DocumentPreviewModalProps {
  document: ContractDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (doc: ContractDocument) => void;
}

function DocumentPreviewModal({ document, isOpen, onClose, onDownload }: DocumentPreviewModalProps) {
  if (!document) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileExtension = (fileName: string) => {
    return fileName.split('.').pop()?.toLowerCase() || '';
  };

  const extension = getFileExtension(document.fileName);
  const mimeType = document.fileType;

  const renderPreview = () => {
    if (extension === 'pdf' || mimeType === 'application/pdf') {
      return (
        <iframe
          src={`${document.fileData}#toolbar=1&navpanes=0`}
          className="w-full h-full min-h-[500px] rounded-lg"
          title={document.name || document.fileName}
        />
      );
    }

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension) || mimeType?.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px] bg-muted rounded-lg p-4">
          <img
            src={document.fileData}
            alt={document.name || document.fileName}
            className="max-w-full max-h-[60vh] object-contain rounded"
          />
        </div>
      );
    }

    if (['doc', 'docx'].includes(extension) || mimeType?.includes('word') || mimeType?.includes('document')) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-muted rounded-lg p-8 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Word Document</h3>
          <p className="text-muted-foreground mb-4">
            Word documents cannot be previewed directly in the browser.
          </p>
          <Button onClick={() => onDownload(document)}>
            <Download className="h-4 w-4 mr-2" />
            Download to View
          </Button>
        </div>
      );
    }

    if (['xls', 'xlsx', 'csv'].includes(extension) || mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-muted rounded-lg p-8 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Spreadsheet</h3>
          <p className="text-muted-foreground mb-4">
            Spreadsheet files cannot be previewed directly in the browser.
          </p>
          <Button onClick={() => onDownload(document)}>
            <Download className="h-4 w-4 mr-2" />
            Download to View
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] bg-muted rounded-lg p-8 text-center">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Preview Not Available</h3>
        <p className="text-muted-foreground mb-4">
          This file type cannot be previewed in the browser.
        </p>
        <Button onClick={() => onDownload(document)}>
          <Download className="h-4 w-4 mr-2" />
          Download File
        </Button>
      </div>
    );
  };

  const docType = (document.documentType || 'other') as DocumentType;
  const typeLabel = DOCUMENT_TYPE_OPTIONS.find(o => o.value === docType)?.label || 'Other';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{document.name || document.fileName}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {typeLabel} • {document.fileName} ({formatFileSize(document.fileSize)})
          </p>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          {renderPreview()}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <Button variant="outline" onClick={() => onDownload(document)}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Template listing data type
interface TemplateListing {
  mlsNumber: string;
  listPrice: number;
  address: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  yearBuilt: number;
  propertyType: string;
  description: string;
  listDate: string;
  status: string;
  images: string[];
  agent?: {
    name: string;
    phone: string;
    email: string;
    brokerage: string;
  };
}

// Room type filter options
const ROOM_TYPES = [
  { id: "all", label: "All", icon: Grid3X3 },
  { id: "kitchen", label: "Kitchen", icon: ChefHat },
  { id: "living", label: "Living Room", icon: Sofa },
  { id: "bedroom", label: "Bedroom", icon: BedDouble },
  { id: "bathroom", label: "Bathroom", icon: Bath },
  { id: "patio", label: "Patio", icon: Trees },
  { id: "exterior", label: "Exterior", icon: Home },
] as const;

export function TransactionDetails({ transaction, coordinators, activities, onBack, initialTab = "overview" }: TransactionDetailsProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { toast } = useToast();
  const [flyerDialogOpen, setFlyerDialogOpen] = useState(false);
  const [editFlyerAsset, setEditFlyerAsset] = useState<{ id: string; config: FlyerAssetConfig } | null>(null);
  const [editGraphicsAsset, setEditGraphicsAsset] = useState<{ id: string; config: SocialGraphicConfig } | null>(null);
  const [graphicsDialogOpen, setGraphicsDialogOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MarketingAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateListing, setTemplateListing] = useState<TemplateListing | null>(null);
  const [templateCategory, setTemplateCategory] = useState<string>("posts");
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const statusLabel = getStatusLabel(transaction.status);
  const mlsData = transaction.mlsData as MLSData | null;
  const cmaData = transaction.cmaData as CMAComparable[] | null;
  const [selectedCMAProperty, setSelectedCMAProperty] = useState<CMAComparable | null>(null);
  const [cmaPhotoIndex, setCmaPhotoIndex] = useState(0);
  const [cmaFullscreenOpen, setCmaFullscreenOpen] = useState(false);
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<ContractDocument | null>(null);
  
  // Key Dates editing state
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editContractDate, setEditContractDate] = useState(transaction.contractDate || '');
  const [editClosingDate, setEditClosingDate] = useState(transaction.closingDate || '');
  
  // Coordinators editing state
  const [isAddingCoordinator, setIsAddingCoordinator] = useState(false);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('');
  
  // Overview photo gallery modal state
  const [overviewPhotoModalOpen, setOverviewPhotoModalOpen] = useState(false);
  const [overviewPhotoIndex, setOverviewPhotoIndex] = useState(0);
  
  // Photo navigation for MLS gallery
  const photos = mlsData?.photos || mlsData?.images || [];
  const nextPhoto = () => setCurrentPhoto((prev) => (prev + 1) % Math.max(photos.length, 1));
  const prevPhoto = () => setCurrentPhoto((prev) => (prev - 1 + photos.length) % Math.max(photos.length, 1));
  
  // Build full address for map
  const fullAddress = mlsData ? 
    `${mlsData.address}, ${mlsData.city}, ${mlsData.state} ${mlsData.zipCode}` : 
    transaction.propertyAddress;
  
  // Check if coordinates are available for map display
  const hasCoordinates = mlsData?.coordinates?.latitude && mlsData?.coordinates?.longitude;
  
  // Reset photo index when MLS data or photos change
  useEffect(() => {
    setCurrentPhoto(0);
  }, [transaction.id, mlsData?.mlsNumber, photos.length]);
  
  // Sync activeTab when initialTab prop changes (e.g., when clicking MLS Sheet button)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, transaction.id]);

  const transactionCoordinators = coordinators.filter(
    (c) => transaction.coordinatorIds?.includes(c.id)
  );

  const { data: marketingAssets = [], isLoading: assetsLoading } = useQuery<MarketingAsset[]>({
    queryKey: [`/api/transactions/${transaction.id}/marketing-assets`],
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<ContractDocument[]>({
    queryKey: [`/api/transactions/${transaction.id}/documents`],
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (data: { name: string; documentType: string; file: File; notes?: string }) => {
      const reader = new FileReader();
      return new Promise<ContractDocument>((resolve, reject) => {
        reader.onload = async () => {
          const fileData = reader.result as string;
          try {
            const res = await apiRequest("POST", `/api/transactions/${transaction.id}/documents`, {
              name: data.name,
              documentType: data.documentType,
              fileName: data.file.name,
              fileData,
              fileType: data.file.type,
              fileSize: data.file.size,
              notes: data.notes,
            });
            resolve(await res.json());
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(data.file);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/documents`] });
      setDocumentUploadOpen(false);
      toast({ title: "Document uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to upload document", variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiRequest("DELETE", `/api/transactions/${transaction.id}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/documents`] });
      toast({ title: "Document deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
    },
  });

  const handleDocumentUpload = (data: { name: string; documentType: DocumentType; file: File; notes?: string }) => {
    uploadDocumentMutation.mutate({
      name: data.name,
      documentType: data.documentType,
      file: data.file,
      notes: data.notes,
    });
  };

  const downloadDocument = (doc: ContractDocument) => {
    const link = document.createElement("a");
    link.href = doc.fileData;
    link.download = doc.fileName;
    link.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const deleteAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      await apiRequest("DELETE", `/api/transactions/${transaction.id}/marketing-assets/${assetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/marketing-assets`] });
      toast({ title: "Marketing asset deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete asset", variant: "destructive" });
    },
  });

  const downloadAsset = (asset: MarketingAsset) => {
    const link = document.createElement("a");
    link.href = asset.imageData;
    link.download = asset.fileName;
    link.click();
  };

  const handleEditAsset = (asset: MarketingAsset) => {
    const metadata = asset.metadata as { config?: FlyerAssetConfig | SocialGraphicConfig; format?: string; status?: string } | null;
    const savedConfig = metadata?.config;
    
    const isPrintFlyer = asset.type === 'print_flyer' || metadata?.format === 'print';
    const isSocialFlyer = asset.type === 'social_flyer' || metadata?.format === 'social';
    
    if (isPrintFlyer || isSocialFlyer) {
      // Flyer type - open CreateFlyerDialog in edit mode
      // Use saved config or fall back to defaults from MLS data
      const config: FlyerAssetConfig = savedConfig ? (savedConfig as FlyerAssetConfig) : {
        format: isPrintFlyer ? 'print' : 'social',
        status: metadata?.status || 'Just Listed',
        description: mlsData?.description || '',
        headline: '',
        photoUrls: mlsData?.photos?.slice(0, 3) || [],
        agentName: '',
        agentTitle: '',
        agentPhone: '',
      };
      setEditFlyerAsset({ id: asset.id, config });
    } else {
      // Social graphics type - open MarketingMaterialsDialog in edit mode
      // Use saved config or fall back to defaults
      const config: SocialGraphicConfig = savedConfig ? (savedConfig as SocialGraphicConfig) : {
        status: metadata?.status || 'just_listed',
        photoUrl: mlsData?.photos?.[0] || '',
        description: '',
      };
      setEditGraphicsAsset({ id: asset.id, config });
      setGraphicsDialogOpen(true);
    }
  };

  const refreshMlsMutation = useMutation({
    mutationFn: async () => {
      console.log("=== REFRESH MLS MUTATION CALLED ===", transaction.id);
      const res = await apiRequest("POST", `/api/transactions/${transaction.id}/refresh-mls`);
      console.log("Response status:", res.status);
      return res.json();
    },
    onSuccess: (data) => {
      console.log("MLS refresh success:", data);
      toast({ title: "MLS data refreshed" });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions", transaction.id] });
    },
    onError: (error) => {
      console.error("MLS refresh error:", error);
      toast({ title: "Failed to refresh MLS data", variant: "destructive" });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async (data: Partial<Transaction>) => {
      const res = await apiRequest("PATCH", `/api/transactions/${transaction.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions", transaction.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: () => {
      toast({ title: "Failed to update transaction", variant: "destructive" });
    },
  });

  const handleSaveDates = async () => {
    await updateTransactionMutation.mutateAsync({
      contractDate: editContractDate || null,
      closingDate: editClosingDate || null,
    });
    setIsEditingDates(false);
    toast({ title: "Key dates updated" });
  };

  const handleAddCoordinator = async () => {
    if (!selectedCoordinatorId) return;
    const updatedIds = [...(transaction.coordinatorIds || []), selectedCoordinatorId];
    await updateTransactionMutation.mutateAsync({ coordinatorIds: updatedIds });
    setSelectedCoordinatorId('');
    setIsAddingCoordinator(false);
    toast({ title: "Coordinator added" });
  };

  const handleRemoveCoordinator = async (coordinatorId: string) => {
    const updatedIds = (transaction.coordinatorIds || []).filter(id => id !== coordinatorId);
    await updateTransactionMutation.mutateAsync({ coordinatorIds: updatedIds });
    toast({ title: "Coordinator removed" });
  };

  // Collect all photos for overview gallery
  const overviewPhotos: string[] = [];
  if (transaction.propertyImages && Array.isArray(transaction.propertyImages)) {
    overviewPhotos.push(...transaction.propertyImages as string[]);
  }
  if (mlsData?.images && Array.isArray(mlsData.images)) {
    overviewPhotos.push(...mlsData.images);
  }

  // Calculate days until closing
  const daysUntilClosing = transaction.closingDate 
    ? Math.ceil((new Date(transaction.closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const searchListingMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch(`/api/listings/search?query=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error("No listing found");
        throw new Error("Failed to search listings");
      }
      return res.json() as Promise<TemplateListing>;
    },
    onSuccess: (data) => {
      setTemplateListing(data);
      toast({ title: "Listing found", description: data.address });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const handleTemplateSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (templateSearch.trim()) {
      searchListingMutation.mutate(templateSearch.trim());
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-semibold truncate" data-testid="text-detail-address">
                {transaction.propertyAddress}
              </h1>
              <Badge className={`shrink-0 ${getStatusBadgeStyle(transaction.status)}`} data-testid="badge-detail-status">
                {statusLabel}
              </Badge>
            </div>
            {transaction.mlsNumber && (
              <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                <span className="font-mono text-xs sm:text-sm">{transaction.mlsNumber}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pl-10 sm:pl-0">
          {transaction.slackChannelId && (
            <Button 
              variant="outline" 
              size="sm"
              className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9" 
              data-testid="button-open-slack"
              onClick={() => window.open(`https://spyglassrealty.slack.com/archives/${transaction.slackChannelId}`, "_blank")}
            >
              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Open</span> Slack
            </Button>
          )}
          {transaction.gmailLabelId && (
            <Button 
              variant="outline" 
              size="sm"
              className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9" 
              data-testid="button-view-emails"
              onClick={() => window.open(`https://mail.google.com/mail/u/0/#label/MC`, "_blank")}
            >
              <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">View</span> Emails
            </Button>
          )}
        </div>
      </div>

      <CreateFlyerDialog
        open={flyerDialogOpen}
        onOpenChange={setFlyerDialogOpen}
        transaction={transaction}
        mlsPhotos={mlsData?.photos || mlsData?.images || []}
        onAssetSaved={() => queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/marketing-assets`] })}
      />

      {/* Edit Flyer Dialog */}
      <CreateFlyerDialog
        open={Boolean(editFlyerAsset)}
        onOpenChange={(open) => {
          if (!open) setEditFlyerAsset(null);
        }}
        transaction={transaction}
        mlsPhotos={mlsData?.photos || mlsData?.images || []}
        onAssetSaved={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/marketing-assets`] });
          setEditFlyerAsset(null);
        }}
        initialData={editFlyerAsset?.config}
        assetId={editFlyerAsset?.id}
      />

      {/* Edit Graphics Dialog */}
      <MarketingMaterialsDialog
        open={graphicsDialogOpen && Boolean(editGraphicsAsset)}
        onOpenChange={(open) => {
          setGraphicsDialogOpen(open);
          if (!open) setEditGraphicsAsset(null);
        }}
        transaction={transaction}
        initialData={editGraphicsAsset?.config}
        assetId={editGraphicsAsset?.id}
        onAssetSaved={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transaction.id}/marketing-assets`] });
          setGraphicsDialogOpen(false);
          setEditGraphicsAsset(null);
        }}
      />

      {/* Asset Preview Modal */}
      <Dialog open={Boolean(previewAsset)} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <VisuallyHidden>
            <DialogTitle>Asset Preview</DialogTitle>
            <DialogDescription>Preview marketing asset</DialogDescription>
          </VisuallyHidden>
          {previewAsset && (() => {
            const metadata = previewAsset.metadata as { format?: string; status?: string; config?: FlyerAssetConfig | SocialGraphicConfig } | null;
            const isPrintFlyer = previewAsset.type === 'print_flyer' || metadata?.format === 'print';
            const isSocialFlyer = previewAsset.type === 'social_flyer' || metadata?.format === 'social';
            const typeLabel = isPrintFlyer ? 'Print Flyer' : 
                              isSocialFlyer ? 'Social 1:1' :
                              previewAsset.type === "facebook" ? "Facebook 16:9" : 
                              previewAsset.type === "instagram" ? "Instagram 1:1" :
                              previewAsset.type === "alt_style" ? "Alt Style" : previewAsset.type;
            const createdDate = previewAsset.createdAt ? new Date(previewAsset.createdAt).toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric',
              year: 'numeric'
            }) : null;
            
            return (
              <div className="space-y-4">
                {/* Large Image Preview */}
                <div className="flex justify-center bg-muted rounded-lg p-4">
                  <img 
                    src={previewAsset.imageData} 
                    alt={previewAsset.fileName}
                    className="max-h-[60vh] object-contain rounded-md"
                    data-testid="img-asset-preview-large"
                  />
                </div>
                
                {/* Asset Info */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Badge variant={isPrintFlyer ? "default" : "secondary"}>
                      {typeLabel}
                    </Badge>
                    {createdDate && (
                      <p className="text-sm text-muted-foreground">
                        Created {createdDate}
                      </p>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        handleEditAsset(previewAsset);
                        setPreviewAsset(null);
                      }}
                      data-testid="button-preview-edit"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        downloadAsset(previewAsset);
                        setPreviewAsset(null);
                      }}
                      data-testid="button-preview-download"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        deleteAssetMutation.mutate(previewAsset.id);
                        setPreviewAsset(null);
                      }}
                      disabled={deleteAssetMutation.isPending}
                      data-testid="button-preview-delete"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-full sm:w-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="mls" className="text-xs sm:text-sm" data-testid="tab-mls">MLS Data</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs sm:text-sm" data-testid="tab-documents">
              Docs
              {documents.length > 0 && (
                <Badge variant="secondary" className="ml-1 sm:ml-2 text-[10px] sm:text-xs">{documents.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="marketing" className="text-xs sm:text-sm" data-testid="tab-marketing">
              Marketing
              {marketingAssets.length > 0 && (
                <Badge variant="secondary" className="ml-1 sm:ml-2 text-[10px] sm:text-xs">{marketingAssets.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="cma" className="text-xs sm:text-sm" data-testid="tab-cma">CMA</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs sm:text-sm" data-testid="tab-templates">Templates</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs sm:text-sm" data-testid="tab-timeline">Timeline</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Property Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">List Price</p>
                    <p className="font-medium">{formatPrice(transaction.listPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sale Price</p>
                    <p className="font-medium">{formatPrice(transaction.salePrice)}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center gap-4 text-sm">
                  {transaction.bedrooms && (
                    <div className="flex items-center gap-1.5">
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <span>{transaction.bedrooms} bed</span>
                    </div>
                  )}
                  {transaction.bathrooms && (
                    <div className="flex items-center gap-1.5">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span>{transaction.bathrooms} bath</span>
                    </div>
                  )}
                  {transaction.sqft && (
                    <div className="flex items-center gap-1.5">
                      <Square className="h-4 w-4 text-muted-foreground" />
                      <span>{transaction.sqft.toLocaleString()} sqft</span>
                    </div>
                  )}
                </div>
                {transaction.yearBuilt && (
                  <p className="text-sm text-muted-foreground">Built in {transaction.yearBuilt}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Key Dates
                </CardTitle>
                {!isEditingDates ? (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      setEditContractDate(transaction.contractDate || '');
                      setEditClosingDate(transaction.closingDate || '');
                      setIsEditingDates(true);
                    }}
                    data-testid="button-edit-dates"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingDates(false)} data-testid="button-cancel-dates">
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSaveDates} 
                      disabled={updateTransactionMutation.isPending}
                      data-testid="button-save-dates"
                    >
                      {updateTransactionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Contract Date</p>
                  {isEditingDates ? (
                    <Input
                      type="date"
                      value={editContractDate}
                      onChange={(e) => setEditContractDate(e.target.value)}
                      className="mt-1"
                      data-testid="input-contract-date"
                    />
                  ) : (
                    <p className="font-medium">{formatDate(transaction.contractDate)}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Closing</p>
                  {isEditingDates ? (
                    <Input
                      type="date"
                      value={editClosingDate}
                      onChange={(e) => setEditClosingDate(e.target.value)}
                      className="mt-1"
                      data-testid="input-closing-date"
                    />
                  ) : (
                    <div>
                      <p className="font-medium">{formatDate(transaction.closingDate)}</p>
                      {daysUntilClosing !== null && daysUntilClosing >= 0 && (
                        <Badge variant="outline" className="mt-1">
                          {daysUntilClosing === 0 ? 'Closing today!' : `${daysUntilClosing} days remaining`}
                        </Badge>
                      )}
                      {daysUntilClosing !== null && daysUntilClosing <= 7 && daysUntilClosing >= 0 && (
                        <Badge variant="destructive" className="mt-1 ml-1">
                          Closing soon!
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Coordinators
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsAddingCoordinator(true)}
                  data-testid="button-add-coordinator"
                >
                  <span className="text-lg leading-none">+</span>
                </Button>
              </CardHeader>
              <CardContent>
                {transactionCoordinators.length > 0 ? (
                  <div className="space-y-3">
                    {transactionCoordinators.map((coord) => (
                      <div key={coord.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {coord.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{coord.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{coord.email}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCoordinator(coord.id)}
                          disabled={updateTransactionMutation.isPending}
                          data-testid={`button-remove-coordinator-${coord.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No coordinators assigned</p>
                )}

                {isAddingCoordinator && (
                  <div className="mt-4 p-3 border rounded-lg space-y-3">
                    <Select value={selectedCoordinatorId} onValueChange={setSelectedCoordinatorId}>
                      <SelectTrigger data-testid="select-coordinator">
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {coordinators
                          .filter(c => !transaction.coordinatorIds?.includes(c.id))
                          .map((coord) => (
                            <SelectItem key={coord.id} value={coord.id}>
                              {coord.name} - {coord.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsAddingCoordinator(false)} data-testid="button-cancel-add-coordinator">
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleAddCoordinator} 
                        disabled={!selectedCoordinatorId || updateTransactionMutation.isPending}
                        data-testid="button-confirm-add-coordinator"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {(transaction.fubClientId || transaction.fubClientName) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Client (Follow Up Boss)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 flex-wrap">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      {transaction.fubClientName?.split(" ").map((n) => n[0]).join("").toUpperCase() || "CL"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{transaction.fubClientName || "Unknown Client"}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                      {transaction.fubClientEmail && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{transaction.fubClientEmail}</span>
                        </div>
                      )}
                      {transaction.fubClientPhone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{transaction.fubClientPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {transaction.fubClientId && (
                    <Button 
                      variant="outline" 
                      className="gap-2" 
                      data-testid="button-view-fub"
                      onClick={() => window.open(`https://spyglassrealty.followupboss.com/2/people/view/${transaction.fubClientId}`, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View in FUB
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Media Section with Photo Modal */}
          {overviewPhotos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Property Photos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {overviewPhotos.slice(0, 8).map((photo, index) => (
                    <div 
                      key={index} 
                      className="relative aspect-video bg-muted rounded-md overflow-hidden cursor-pointer group"
                      onClick={() => {
                        setOverviewPhotoIndex(index);
                        setOverviewPhotoModalOpen(true);
                      }}
                      data-testid={`button-photo-${index}`}
                    >
                      <img
                        src={`/api/proxy-image?url=${encodeURIComponent(photo)}`}
                        alt={`Property photo ${index + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        data-testid={`img-property-photo-${index}`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
                {overviewPhotos.length > 8 && (
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => {
                      setOverviewPhotoIndex(0);
                      setOverviewPhotoModalOpen(true);
                    }}
                    data-testid="button-view-all-photos"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    View all {overviewPhotos.length} photos
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mls" className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold">MLS Listing Data</h2>
              {transaction.mlsLastSyncedAt && (
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-mls-sync-status">
                  Auto-synced {new Date(transaction.mlsLastSyncedAt).toLocaleString()}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => refreshMlsMutation.mutate()}
              disabled={refreshMlsMutation.isPending}
              data-testid="button-refresh-mls"
            >
              {refreshMlsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh MLS Data
            </Button>
          </div>

          {mlsData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Photos, Features, Description, Map */}
              <div className="lg:col-span-2 space-y-6">
                {/* Photo Gallery - Main + Thumbnail Grid Layout */}
                {photos.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Property Photos
                      </CardTitle>
                      <Badge variant="secondary" data-testid="badge-photo-count">
                        {mlsData.photoCount || photos.length} photos
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="flex gap-1 rounded-t-lg overflow-hidden">
                        {/* Main Photo (left ~60%) */}
                        <div className="relative flex-[3] min-h-[400px]">
                          <img 
                            src={`/api/proxy-image?url=${encodeURIComponent(photos[currentPhoto] || '')}`}
                            alt={`Property photo ${currentPhoto + 1}`}
                            className="w-full h-full object-cover cursor-pointer"
                            data-testid="img-mls-main-photo"
                            onClick={() => setFullscreenOpen(true)}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f0f0f0' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23999' dy='0.3em'%3ENo Image%3C/text%3E%3C/svg%3E";
                            }}
                          />
                          {photos.length > 1 && (
                            <>
                              <button 
                                onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                                data-testid="button-photo-prev"
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                                data-testid="button-photo-next"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </button>
                            </>
                          )}
                          <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/60 text-white text-sm rounded-full">
                            {currentPhoto + 1} / {photos.length}
                          </div>
                          <button 
                            onClick={() => setFullscreenOpen(true)}
                            className="absolute bottom-3 right-3 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                            data-testid="button-fullscreen-photo"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* Thumbnail Grid (right ~40%, 2 cols x 3 rows) */}
                        {photos.length > 1 && (
                          <div className="flex-[2] grid grid-cols-2 grid-rows-3 gap-1">
                            {photos.slice(1, 7).map((photo, i) => {
                              const isLastThumbnail = i === 5 || (photos.length <= 7 && i === photos.length - 2);
                              const showSeeAll = isLastThumbnail && photos.length > 6;
                              
                              return (
                                <button
                                  key={i}
                                  onClick={() => showSeeAll ? setFullscreenOpen(true) : setCurrentPhoto(i + 1)}
                                  className="relative w-full h-full overflow-hidden hover-elevate"
                                  data-testid={`button-thumbnail-${i}`}
                                >
                                  <img 
                                    src={`/api/proxy-image?url=${encodeURIComponent(photo)}`} 
                                    alt={`Thumbnail ${i + 2}`} 
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                  {showSeeAll && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-medium">
                                      See all {photos.length} photos
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Feature Tags Row */}
                {(() => {
                  const featureTags: { icon: any; label: string }[] = [];
                  
                  // View type from details.viewType
                  if (mlsData.viewType && mlsData.viewType !== "None") {
                    featureTags.push({ icon: Eye, label: mlsData.viewType });
                  }
                  
                  // Garage from details.garage
                  if (mlsData.garage) {
                    const garageLabel = mlsData.garage.includes("Car") ? mlsData.garage : `${mlsData.garage} Car Garage`;
                    featureTags.push({ icon: Car, label: garageLabel });
                  }
                  
                  // Patio from details.patio
                  if (mlsData.patio && mlsData.patio !== "None") {
                    featureTags.push({ icon: Sofa, label: mlsData.patio });
                  }
                  
                  // Pool from details.swimmingPool
                  if (mlsData.pool && mlsData.pool !== "None") {
                    featureTags.push({ icon: Waves, label: mlsData.pool });
                  }
                  
                  // Fireplace check from extras or interior features
                  const hasFireplace = mlsData.extras?.toLowerCase().includes('fireplace') ||
                    mlsData.interiorFeatures?.some(f => f.toLowerCase().includes('fireplace'));
                  if (hasFireplace) {
                    featureTags.push({ icon: Flame, label: "Fireplace" });
                  }
                  
                  // Stories
                  if (mlsData.stories && mlsData.stories > 1) {
                    featureTags.push({ icon: Building, label: `${mlsData.stories} Stories` });
                  }
                  
                  if (featureTags.length === 0) return null;
                  
                  return (
                    <div className="flex flex-wrap gap-2" data-testid="feature-tags">
                      {featureTags.map((tag, idx) => {
                        const TagIcon = tag.icon;
                        return (
                          <Badge key={idx} variant="secondary" className="gap-1.5 px-3 py-1.5">
                            <TagIcon className="h-3.5 w-3.5" />
                            {tag.label}
                          </Badge>
                        );
                      })}
                    </div>
                  );
                })()}
                
                {/* About This Home */}
                {mlsData.description && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">About This Home</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">{mlsData.description}</p>
                    </CardContent>
                  </Card>
                )}
                
                {/* Property Details Grid (2 columns) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Property Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      {mlsData.mlsNumber && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">MLS #</span>
                            <span className="font-mono">{mlsData.mlsNumber}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Status</span>
                            <span>{mlsData.status || 'Unknown'}</span>
                          </div>
                        </>
                      )}
                      
                      {mlsData.propertyType && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Property Type</span>
                          <span>{mlsData.propertyType}</span>
                        </div>
                      )}
                      
                      {mlsData.yearBuilt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Year Built</span>
                          <span>{mlsData.yearBuilt}</span>
                        </div>
                      )}
                      
                      {mlsData.listDate && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Listed Date</span>
                          <span>{new Date(mlsData.listDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      
                      {mlsData.daysOnMarket !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Days on Market</span>
                          <span>{mlsData.daysOnMarket}</span>
                        </div>
                      )}
                      
                      {mlsData.subdivision && (
                        <div className="flex justify-between text-sm col-span-2">
                          <span className="text-muted-foreground">Subdivision</span>
                          <span>{mlsData.subdivision}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Property Features */}
                {((mlsData.interiorFeatures?.length || 0) > 0 || (mlsData.exteriorFeatures?.length || 0) > 0 || (mlsData.appliances?.length || 0) > 0 || (mlsData.heatingCooling?.length || 0) > 0 || (mlsData.flooring?.length || 0) > 0 || (mlsData.parking?.length || 0) > 0 || (mlsData.constructionMaterials?.length || 0) > 0 || mlsData.roofMaterial || mlsData.foundation || mlsData.pool || mlsData.waterSource || mlsData.sewer) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Property Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="divide-y divide-border">
                        <FeatureSection title="Interior Features" items={mlsData.interiorFeatures || []} defaultOpen={true} />
                        <FeatureSection title="Exterior Features" items={mlsData.exteriorFeatures || []} />
                        <FeatureSection title="Appliances" items={mlsData.appliances || []} />
                        <FeatureSection title="Heating & Cooling" items={mlsData.heatingCooling || []} />
                        <FeatureSection title="Flooring" items={mlsData.flooring || []} />
                        <FeatureSection title="Parking" items={mlsData.parking || []} />
                        <FeatureSection title="Construction" items={mlsData.constructionMaterials || []} />
                      </div>
                      
                      {/* Single-value property details */}
                      {(mlsData.roofMaterial || mlsData.foundation || mlsData.pool || mlsData.waterSource || mlsData.sewer) && (
                        <div className="mt-4 pt-4 border-t space-y-2">
                          {mlsData.roofMaterial && mlsData.roofMaterial !== "None" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Roof</span>
                              <span>{mlsData.roofMaterial}</span>
                            </div>
                          )}
                          {mlsData.foundation && mlsData.foundation !== "None" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Foundation</span>
                              <span>{mlsData.foundation}</span>
                            </div>
                          )}
                          {mlsData.pool && mlsData.pool !== "None" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Pool</span>
                              <span>{mlsData.pool}</span>
                            </div>
                          )}
                          {mlsData.waterSource && mlsData.waterSource !== "None" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Water Source</span>
                              <span>{mlsData.waterSource}</span>
                            </div>
                          )}
                          {mlsData.sewer && mlsData.sewer !== "None" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Sewer</span>
                              <span>{mlsData.sewer}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {/* Location Map */}
                {hasCoordinates && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Structured Address */}
                      <div>
                        <p className="font-medium">{transaction.propertyAddress}</p>
                        <p className="text-sm text-muted-foreground">
                          {mlsData.city}{mlsData.city && mlsData.state ? ', ' : ''}{mlsData.state} {mlsData.zipCode}
                        </p>
                      </div>
                      
                      {/* Neighborhood */}
                      {mlsData.neighborhood && (
                        <div className="flex items-center gap-2 text-sm">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <span>Neighborhood: <strong>{mlsData.neighborhood}</strong></span>
                        </div>
                      )}
                      
                      {/* Map */}
                      <div className="-mx-6 -mb-6">
                        <MapboxPropertyMap
                          latitude={mlsData.coordinates!.latitude}
                          longitude={mlsData.coordinates!.longitude}
                          address={`${transaction.propertyAddress}, ${mlsData.city || ''}, ${mlsData.state || ''}`}
                          price={mlsData.listPrice}
                          beds={mlsData.bedrooms}
                          baths={mlsData.bathrooms}
                          sqft={mlsData.sqft}
                          status={mlsData.status}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* Right Column - Stats & Details */}
              <div className="space-y-6">
                {/* Price & Status Card */}
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    {/* Status Badges Row */}
                    <div className="flex items-center flex-wrap gap-2">
                      <Badge className={getStatusBadgeStyle(mlsData.status || 'Unknown')}>
                        {mlsData.status || 'Unknown'}
                      </Badge>
                      {/* lastStatus ribbons */}
                      {mlsData.lastStatus === 'Pc' && (
                        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Price Reduced
                        </Badge>
                      )}
                      {mlsData.lastStatus === 'Bom' && (
                        <Badge className="bg-blue-500 hover:bg-blue-600 text-white">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Back on Market
                        </Badge>
                      )}
                    </div>
                    
                    {/* Days on Market */}
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span>{getDisplayDOM(mlsData) ?? 0} days on market</span>
                      {!hasAccurateDOM(mlsData) && getDisplayDOM(mlsData) != null && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">May vary based on MLS update timing</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    
                    {/* Current Price */}
                    {mlsData.listPrice != null && (
                      <div className="text-3xl font-bold" data-testid="text-mls-price">
                        {formatPrice(mlsData.listPrice)}
                      </div>
                    )}
                    
                    {/* Price per sqft */}
                    {mlsData.listPrice != null && mlsData.sqft > 0 && (
                      <div className="text-muted-foreground text-sm">
                        ${Math.round(mlsData.listPrice / mlsData.sqft).toLocaleString()}/sqft
                      </div>
                    )}
                    
                    {/* Price History (if originalPrice differs from listPrice) */}
                    {mlsData.originalPrice != null && mlsData.listPrice != null && mlsData.originalPrice !== mlsData.listPrice && (
                      <div className="pt-3 border-t space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Original Price</span>
                          <span className="line-through text-muted-foreground">
                            {formatPrice(mlsData.originalPrice)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Change</span>
                          <Badge 
                            variant="secondary" 
                            className={mlsData.listPrice < mlsData.originalPrice 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}
                          >
                            {mlsData.listPrice < mlsData.originalPrice ? (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            )}
                            {Math.abs(((mlsData.listPrice - mlsData.originalPrice) / mlsData.originalPrice) * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    )}
                    
                    {/* Virtual Tour removed for MLS/IDX/VOW compliance - field still ingested for internal use only */}
                  </CardContent>
                </Card>
                
                {/* Sold Information (for closed transactions) */}
                {mlsData.soldPrice != null && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Sale Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sold Price</span>
                        <span className="font-bold">{formatPrice(mlsData.soldPrice)}</span>
                      </div>
                      {mlsData.soldDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sold Date</span>
                          <span>{new Date(mlsData.soldDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {mlsData.listPrice != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">List vs Sold</span>
                          <Badge 
                            variant="secondary"
                            className={mlsData.soldPrice >= mlsData.listPrice 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}
                          >
                            {mlsData.soldPrice >= mlsData.listPrice ? 'At/Above' : 'Below'} List
                            ({((mlsData.soldPrice / mlsData.listPrice) * 100).toFixed(1)}%)
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {/* Property Stats */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Property Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Bed className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Beds</div>
                          <div className="font-semibold">{mlsData.bedrooms || 0}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Bath className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Baths</div>
                          <div className="font-semibold">
                            {mlsData.bathrooms || 0}{mlsData.halfBaths > 0 && `.${mlsData.halfBaths}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Square className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Sq Ft</div>
                          <div className="font-semibold">{mlsData.sqft?.toLocaleString() || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Lot</div>
                          <div className="font-semibold text-sm">{mlsData.lotSize || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Year Built</div>
                          <div className="font-semibold">{mlsData.yearBuilt || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Building className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Stories</div>
                          <div className="font-semibold">{mlsData.stories || 1}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Financial Info */}
                {(mlsData.hoaFee || mlsData.taxAmount) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Financial Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {mlsData.hoaFee && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">HOA Fee</span>
                          <span className="font-medium">${mlsData.hoaFee}/{mlsData.hoaFrequency || 'Monthly'}</span>
                        </div>
                      )}
                      {mlsData.taxAmount && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Annual Taxes</span>
                          <span className="font-medium">
                            ${typeof mlsData.taxAmount === 'object' && mlsData.taxAmount !== null
                              ? ((mlsData.taxAmount as any).annualAmount || 0).toLocaleString()
                              : (mlsData.taxAmount as number).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {(mlsData.taxYear || (typeof mlsData.taxAmount === 'object' && (mlsData.taxAmount as any)?.assessmentYear)) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax Year</span>
                          <span className="font-medium">
                            {mlsData.taxYear || (mlsData.taxAmount as any)?.assessmentYear}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {/* Listing Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Listing Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">MLS #</span>
                      <span className="font-mono font-medium">{mlsData.mlsNumber || transaction.mlsNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">List Date</span>
                      <span className="font-medium">{formatDate(mlsData.listDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Property Type</span>
                      <span className="font-medium">{mlsData.propertyType || '—'}</span>
                    </div>
                    {mlsData.propertyStyle && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Style</span>
                        <span className="font-medium">{mlsData.propertyStyle}</span>
                      </div>
                    )}
                    {mlsData.garage && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Garage</span>
                        <span className="font-medium">{mlsData.garage}</span>
                      </div>
                    )}
                    <Separator className="my-2" />
                    {(mlsData.listingAgent || mlsData.agent?.name) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Agent</span>
                        <span className="font-medium">{mlsData.listingAgent || mlsData.agent?.name}</span>
                      </div>
                    )}
                    {(mlsData.listingOffice || mlsData.agent?.brokerage) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Office</span>
                        <span className="font-medium text-right max-w-[150px] truncate">
                          {typeof mlsData.listingOffice === 'object' && mlsData.listingOffice !== null 
                            ? (mlsData.listingOffice as any).name 
                            : mlsData.listingOffice || 
                              (typeof mlsData.agent?.brokerage === 'object' && mlsData.agent?.brokerage !== null
                                ? (mlsData.agent.brokerage as any).name
                                : mlsData.agent?.brokerage)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No MLS Data Available</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  MLS data hasn't been fetched for this property yet.
                </p>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => refreshMlsMutation.mutate()}
                  disabled={refreshMlsMutation.isPending}
                  data-testid="button-fetch-mls"
                >
                  {refreshMlsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Fetch MLS Data
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Fullscreen Photo Modal - only render if photos exist */}
          {photos.length > 0 && (
            <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
              <DialogContent className="w-[98vw] sm:max-w-[95vw] h-[95vh] sm:max-h-[95vh] p-0 bg-black/95 border-none [&>button]:bg-white/10 [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:active:bg-white/30 [&>button]:rounded-full [&>button]:opacity-100 [&>button]:p-1.5 sm:[&>button]:p-2 [&>button]:hover:opacity-100">
                <VisuallyHidden>
                  <DialogTitle>Property Photo Gallery</DialogTitle>
                  <DialogDescription>View property photos in fullscreen mode</DialogDescription>
                </VisuallyHidden>
                <div className="relative w-full h-full flex items-center justify-center min-h-[70vh] sm:min-h-[80vh]">
                  {/* Photo Counter */}
                  <div className="absolute top-2 sm:top-4 left-2 sm:left-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 text-white rounded-full text-xs sm:text-sm z-10">
                    {currentPhoto + 1} of {photos.length}
                  </div>
                  
                  {/* Main Image */}
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(photos[currentPhoto] || '')}`}
                    alt={`Property photo ${currentPhoto + 1}`}
                    className="max-w-full max-h-[65vh] sm:max-h-[80vh] object-contain touch-manipulation"
                    data-testid="img-fullscreen-photo"
                  />
                  
                  {/* Navigation Arrows */}
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={prevPhoto}
                        className="absolute left-1 sm:left-4 p-2 sm:p-3 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full text-white transition-colors touch-manipulation"
                        data-testid="button-fullscreen-prev"
                      >
                        <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
                      </button>
                      <button
                        onClick={nextPhoto}
                        className="absolute right-1 sm:right-4 p-2 sm:p-3 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full text-white transition-colors touch-manipulation"
                        data-testid="button-fullscreen-next"
                      >
                        <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
                      </button>
                    </>
                  )}
                  
                  {/* Thumbnail Strip at Bottom */}
                  <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-black/50 rounded-lg max-w-[95vw] sm:max-w-[90vw] overflow-x-auto scrollbar-hide">
                    {photos.map((photo, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPhoto(i)}
                        className={`flex-shrink-0 w-12 h-9 sm:w-16 sm:h-12 rounded overflow-hidden border-2 transition-colors touch-manipulation ${
                          i === currentPhoto ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100 active:opacity-100'
                        }`}
                        data-testid={`button-fullscreen-thumb-${i}`}
                      >
                        <img
                          src={`/api/proxy-image?url=${encodeURIComponent(photo)}`}
                          alt={`Thumbnail ${i + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="cma" className="space-y-6">
          <h2 className="text-lg font-semibold">Comparative Market Analysis</h2>

          {cmaData && cmaData.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cmaData.map((comp, index) => (
                <Card 
                  key={index} 
                  className="cursor-pointer hover-elevate transition-all"
                  onClick={() => setSelectedCMAProperty(comp)}
                  data-testid={`card-cma-${index}`}
                >
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{comp.address}</p>
                        <p className="text-lg font-semibold">{formatPrice(comp.price)}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {comp.distance.toFixed(1)} mi
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Bed className="h-3.5 w-3.5" />
                        {comp.bedrooms}
                      </div>
                      <div className="flex items-center gap-1">
                        <Bath className="h-3.5 w-3.5" />
                        {comp.bathrooms}
                      </div>
                      <div className="flex items-center gap-1">
                        <Square className="h-3.5 w-3.5" />
                        {typeof comp.sqft === 'number' ? comp.sqft.toLocaleString() : comp.sqft}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {comp.daysOnMarket} days on market
                    </div>
                    {comp.mlsNumber && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        {comp.mlsNumber}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No CMA Data Available</h3>
                <p className="text-sm text-muted-foreground">
                  Comparative market analysis will appear here once MLS data is fetched.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold">Contract Documents</h2>
            <Button
              variant="outline"
              onClick={() => setDocumentUploadOpen(true)}
              data-testid="button-upload-document"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Documents
            </Button>
          </div>

          {documentsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-md" />
              ))}
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => {
                const docType = (doc.documentType || 'other') as DocumentType;
                const typeLabel = DOCUMENT_TYPE_OPTIONS.find(o => o.value === docType)?.label || 'Other';
                const typeColor = DOCUMENT_TYPE_COLORS[docType] || DOCUMENT_TYPE_COLORS.other;
                
                return (
                  <Card key={doc.id} className="hover:bg-muted/50 transition-colors" data-testid={`card-document-${doc.id}`}>
                    <CardContent className="flex items-start gap-4 py-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted flex-shrink-0">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{doc.name || doc.fileName}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className={`${typeColor} text-xs`} variant="secondary">
                            {typeLabel}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Uploaded {formatDate(doc.createdAt ? new Date(doc.createdAt).toISOString() : null)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {doc.fileName} ({formatFileSize(doc.fileSize)})
                        </p>
                        {doc.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic">
                            "{doc.notes}"
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setPreviewDocument(doc)}
                              data-testid={`button-preview-doc-${doc.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Preview</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => downloadDocument(doc)}
                              data-testid={`button-download-doc-${doc.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Download</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteDocumentMutation.mutate(doc.id)}
                              disabled={deleteDocumentMutation.isPending}
                              data-testid={`button-delete-doc-${doc.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No Documents Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Upload contract documents, amendments, and other files for this transaction.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Use the "Upload Documents" button above to get started.
                </p>
              </CardContent>
            </Card>
          )}

          <DocumentUploadDialog
            isOpen={documentUploadOpen}
            onClose={() => setDocumentUploadOpen(false)}
            onUpload={handleDocumentUpload}
            isUploading={uploadDocumentMutation.isPending}
          />

          <DocumentPreviewModal
            document={previewDocument}
            isOpen={!!previewDocument}
            onClose={() => setPreviewDocument(null)}
            onDownload={downloadDocument}
          />
        </TabsContent>

        <TabsContent value="marketing" className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold">Marketing Assets</h2>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => setGraphicsDialogOpen(true)}
                data-testid="button-create-graphics"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Create Graphics
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setFlyerDialogOpen(true)}
                data-testid="button-create-flyer"
              >
                <FileImage className="h-4 w-4 mr-2" />
                Create Flyer
              </Button>
            </div>
          </div>

          {assetsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-md" />
              ))}
            </div>
          ) : marketingAssets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {marketingAssets.map((asset) => {
                const metadata = asset.metadata as { format?: string; status?: string; dimensions?: string; headline?: string } | null;
                const isPrintFlyer = asset.type === 'print_flyer' || metadata?.format === 'print';
                const isSocialFlyer = asset.type === 'social_flyer' || metadata?.format === 'social';
                const isLandscape = asset.type === 'facebook';
                const isSquare = asset.type === 'instagram' || isSocialFlyer;
                const isStory = asset.type === 'story';
                const isAltStyle = asset.type === 'alt_style';
                
                const typeLabel = isPrintFlyer ? 'Print Flyer' : 
                                  isLandscape ? 'Facebook 16:9' :
                                  isSquare ? 'Instagram 1:1' :
                                  isStory ? 'Story 9:16' :
                                  isAltStyle ? 'Alt Style' : asset.type;
                
                const getBadgeStyle = () => {
                  if (isPrintFlyer) return 'bg-orange-500 text-white hover:bg-orange-600';
                  if (isLandscape) return 'bg-purple-500 text-white hover:bg-purple-600';
                  if (isSquare) return 'bg-blue-500 text-white hover:bg-blue-600';
                  if (isStory) return 'bg-pink-500 text-white hover:bg-pink-600';
                  if (isAltStyle) return 'bg-gray-500 text-white hover:bg-gray-600';
                  return 'bg-gray-500 text-white hover:bg-gray-600';
                };
                
                const statusLabel = metadata?.status;
                const createdDate = asset.createdAt ? new Date(asset.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
                
                return (
                  <Card key={asset.id} data-testid={`card-asset-${asset.id}`} className="overflow-hidden flex flex-col">
                    <div 
                      className="h-64 bg-muted overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setPreviewAsset(asset)}
                      data-testid={`button-preview-asset-${asset.id}`}
                    >
                      <img 
                        src={asset.imageData} 
                        alt={asset.fileName}
                        className="w-full h-full object-cover"
                        data-testid={`img-asset-${asset.id}`}
                      />
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <Badge className={`text-xs ${getBadgeStyle()}`}>
                            {typeLabel}
                          </Badge>
                          {statusLabel && (
                            <p className="text-sm font-medium">{statusLabel}</p>
                          )}
                          {createdDate && (
                            <p className="text-xs text-muted-foreground">{createdDate}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditAsset(asset)}
                            data-testid={`button-edit-asset-${asset.id}`}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => downloadAsset(asset)}
                            data-testid={`button-download-asset-${asset.id}`}
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteAssetMutation.mutate(asset.id)}
                            disabled={deleteAssetMutation.isPending}
                            data-testid={`button-delete-asset-${asset.id}`}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No Marketing Assets Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Use the buttons above to create social media graphics or print flyers.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <h2 className="text-lg font-semibold">Activity Timeline</h2>

          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1 w-px bg-border" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(activity.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No Activity Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Activity will be recorded as actions are taken on this transaction.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Listing Marketing Templates</h2>
              <p className="text-sm text-muted-foreground">
                Search for a listing by address or MLS number to generate marketing templates
              </p>
            </div>

            <form onSubmit={handleTemplateSearch} className="flex gap-2 max-w-xl">
              <Input
                placeholder="Enter address or MLS number..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                data-testid="input-template-search"
              />
              <Button 
                type="submit" 
                disabled={searchListingMutation.isPending || !templateSearch.trim()}
                data-testid="button-search-listing"
              >
                {searchListingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </form>

            {templateListing && (
              <div className="space-y-6">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      {templateListing.images[0] && (
                        <div className="w-24 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                          <img
                            src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[0])}`}
                            alt={templateListing.address}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{templateListing.address}</h3>
                          <Badge className={getStatusBadgeStyle(templateListing.status)}>{getStatusLabel(templateListing.status)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {templateListing.city}, {templateListing.state}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="font-semibold">{formatPrice(templateListing.listPrice)}</span>
                          <span className="flex items-center gap-1">
                            <Bed className="h-3.5 w-3.5" /> {templateListing.bedrooms}
                          </span>
                          <span className="flex items-center gap-1">
                            <Bath className="h-3.5 w-3.5" /> {templateListing.bathrooms}
                          </span>
                          <span className="flex items-center gap-1">
                            <Square className="h-3.5 w-3.5" /> {templateListing.sqft.toLocaleString()} sqft
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-2 flex-wrap border-b pb-4">
                  {[
                    { id: "posts", label: "Posts", icon: Layout },
                    { id: "stories", label: "Stories", icon: Smartphone },
                    { id: "flyers", label: "Flyers", icon: Newspaper },
                    { id: "postcards", label: "Post Cards", icon: CreditCard },
                    { id: "brochures", label: "Brochures", icon: BookOpen },
                  ].map((cat) => (
                    <Button
                      key={cat.id}
                      variant={templateCategory === cat.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTemplateCategory(cat.id)}
                      data-testid={`button-template-cat-${cat.id}`}
                    >
                      <cat.icon className="h-4 w-4 mr-2" />
                      {cat.label}
                    </Button>
                  ))}
                </div>

                <div className="space-y-4">
                  {templateCategory === "posts" && (
                    <div>
                      <h3 className="text-base font-medium mb-4">Social Media Posts</h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {templateListing.images.slice(0, 4).map((img, idx) => (
                          <Card key={idx} className="overflow-hidden">
                            <div className="relative aspect-square bg-black">
                              <img
                                src={`/api/proxy-image?url=${encodeURIComponent(img)}`}
                                alt={`Post template ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                                <p className="text-xs font-semibold uppercase tracking-wider mb-1">Just Listed</p>
                                <p className="text-sm font-medium line-clamp-2">{templateListing.address}</p>
                                <p className="text-xs mt-1">{formatPrice(templateListing.listPrice)}</p>
                              </div>
                              <div className="absolute top-2 right-2 bg-white/90 dark:bg-black/90 px-2 py-1 rounded text-xs font-semibold">
                                SPYGLASS REALTY
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {templateCategory === "stories" && (
                    <div>
                      <h3 className="text-base font-medium mb-4">Stories (9:16)</h3>
                      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                        {templateListing.images.slice(0, 4).map((img, idx) => (
                          <Card key={idx} className="overflow-hidden">
                            <div className="relative aspect-[9/16] bg-black">
                              <img
                                src={`/api/proxy-image?url=${encodeURIComponent(img)}`}
                                alt={`Story template ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                              <div className="absolute top-4 left-0 right-0 text-center text-white">
                                <p className="text-xs font-semibold uppercase tracking-wider">Spyglass Realty</p>
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 p-4 text-white text-center">
                                <p className="text-lg font-bold">{formatPrice(templateListing.listPrice)}</p>
                                <p className="text-sm">{templateListing.address}</p>
                                <p className="text-xs mt-1 opacity-80">
                                  {templateListing.bedrooms} bed | {templateListing.bathrooms} bath | {templateListing.sqft.toLocaleString()} sqft
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {templateCategory === "flyers" && (
                    <div>
                      <h3 className="text-base font-medium mb-4">Property Flyers</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="overflow-hidden">
                          <div className="relative aspect-[8.5/11] bg-white dark:bg-card p-4">
                            <div className="h-full border rounded-md p-4 flex flex-col">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold uppercase tracking-wider">Spyglass Realty</span>
                                <Badge variant="outline" className="text-xs">Just Listed</Badge>
                              </div>
                              {templateListing.images[0] && (
                                <div className="w-full aspect-video rounded-md overflow-hidden bg-muted mb-3">
                                  <img
                                    src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[0])}`}
                                    alt="Main photo"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <h4 className="font-semibold text-sm">{templateListing.address}</h4>
                              <p className="text-xs text-muted-foreground">{templateListing.city}, {templateListing.state}</p>
                              <p className="text-lg font-bold mt-2">{formatPrice(templateListing.listPrice)}</p>
                              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                <span>{templateListing.bedrooms} Beds</span>
                                <span>{templateListing.bathrooms} Baths</span>
                                <span>{templateListing.sqft.toLocaleString()} Sqft</span>
                              </div>
                              {templateListing.description && (
                                <p className="text-xs mt-3 line-clamp-4 text-muted-foreground flex-1">
                                  {templateListing.description}
                                </p>
                              )}
                              <div className="mt-auto pt-3 border-t text-xs text-center text-muted-foreground">
                                Contact your agent for more information
                              </div>
                            </div>
                          </div>
                        </Card>
                        <Card className="overflow-hidden">
                          <div className="relative aspect-[8.5/11] bg-white dark:bg-card">
                            {templateListing.images[0] && (
                              <img
                                src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[0])}`}
                                alt="Full bleed"
                                className="w-full h-full object-cover"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                              <span className="text-white text-sm font-semibold">SPYGLASS REALTY</span>
                              <Badge className="bg-white text-black">Just Listed</Badge>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                              <p className="text-2xl font-bold">{formatPrice(templateListing.listPrice)}</p>
                              <p className="text-lg font-medium mt-1">{templateListing.address}</p>
                              <p className="text-sm opacity-80">{templateListing.city}, {templateListing.state}</p>
                              <div className="flex gap-4 mt-3 text-sm">
                                <span>{templateListing.bedrooms} Beds</span>
                                <span>{templateListing.bathrooms} Baths</span>
                                <span>{templateListing.sqft.toLocaleString()} Sqft</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  )}

                  {templateCategory === "postcards" && (
                    <div>
                      <h3 className="text-base font-medium mb-4">Post Cards</h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {["Open House", "Just Listed", "Under Contract"].map((type, idx) => (
                          <Card key={idx} className="overflow-hidden">
                            <div className="relative aspect-[6/4] bg-white dark:bg-card">
                              {templateListing.images[0] && (
                                <img
                                  src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[idx % templateListing.images.length] || templateListing.images[0])}`}
                                  alt={type}
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
                              <div className="absolute top-0 left-0 bottom-0 w-1/2 p-4 flex flex-col justify-between text-white">
                                <div>
                                  <span className="text-xs font-semibold opacity-80">SPYGLASS REALTY</span>
                                  <p className="text-lg font-bold mt-2">{type}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{templateListing.address}</p>
                                  <p className="text-xs opacity-80">{templateListing.city}, {templateListing.state}</p>
                                  <p className="text-base font-bold mt-1">{formatPrice(templateListing.listPrice)}</p>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {templateCategory === "brochures" && (
                    <div>
                      <h3 className="text-base font-medium mb-4">Brochures</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="overflow-hidden">
                          <div className="relative aspect-[8.5/11] bg-white dark:bg-card p-6">
                            <div className="h-full flex flex-col">
                              <div className="text-center mb-4">
                                <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Spyglass Realty</span>
                              </div>
                              <p className="text-2xl font-bold text-center">{templateListing.address}</p>
                              <p className="text-center text-muted-foreground">{templateListing.city}, {templateListing.state}</p>
                              {templateListing.images[0] && (
                                <div className="w-full aspect-video rounded-md overflow-hidden bg-muted my-4">
                                  <img
                                    src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[0])}`}
                                    alt="Main"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex justify-center gap-6 mb-4 text-center">
                                <div>
                                  <p className="text-xl font-bold">{templateListing.bedrooms}</p>
                                  <p className="text-xs text-muted-foreground">Beds</p>
                                </div>
                                <div>
                                  <p className="text-xl font-bold">{templateListing.bathrooms}</p>
                                  <p className="text-xs text-muted-foreground">Baths</p>
                                </div>
                                <div>
                                  <p className="text-xl font-bold">{templateListing.sqft.toLocaleString()}</p>
                                  <p className="text-xs text-muted-foreground">Sqft</p>
                                </div>
                              </div>
                              <p className="text-2xl font-bold text-center mb-4">{formatPrice(templateListing.listPrice)}</p>
                              {templateListing.description && (
                                <p className="text-xs text-muted-foreground line-clamp-6 flex-1">
                                  {templateListing.description}
                                </p>
                              )}
                              <div className="grid grid-cols-3 gap-2 mt-4">
                                {templateListing.images.slice(1, 4).map((img, i) => (
                                  <div key={i} className="aspect-square rounded-md overflow-hidden bg-muted">
                                    <img
                                      src={`/api/proxy-image?url=${encodeURIComponent(img)}`}
                                      alt={`Photo ${i + 2}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </Card>
                        <Card className="overflow-hidden">
                          <div className="relative aspect-[8.5/11] bg-white dark:bg-card flex">
                            <div className="w-2/5 p-4 flex flex-col justify-center bg-gradient-to-b from-primary/10 to-primary/5">
                              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Open House</p>
                              <p className="text-lg font-bold">{formatPrice(templateListing.listPrice)}</p>
                              <p className="text-sm font-medium mt-2">{templateListing.address}</p>
                              <p className="text-xs text-muted-foreground">{templateListing.city}, {templateListing.state}</p>
                              <div className="mt-4 space-y-1 text-sm">
                                <p>{templateListing.bedrooms} Bedrooms</p>
                                <p>{templateListing.bathrooms} Bathrooms</p>
                                <p>{templateListing.sqft.toLocaleString()} Sqft</p>
                              </div>
                              <div className="mt-auto pt-4">
                                <p className="text-xs font-semibold">Spyglass Realty</p>
                              </div>
                            </div>
                            <div className="w-3/5 relative">
                              {templateListing.images[0] && (
                                <img
                                  src={`/api/proxy-image?url=${encodeURIComponent(templateListing.images[0])}`}
                                  alt="Feature"
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  )}
                </div>

                {templateListing.images.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="font-medium mb-2">No Photos Available</h3>
                      <p className="text-sm text-muted-foreground">
                        This listing doesn't have any photos to use for templates.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {!templateListing && !searchListingMutation.isPending && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium mb-2">Search for a Listing</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Enter an address or MLS number above to find a listing and generate marketing templates with photos, pricing, and property details.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* CMA Property Detail Modal */}
      <Dialog open={!!selectedCMAProperty} onOpenChange={(open) => {
        if (!open) {
          setSelectedCMAProperty(null);
          setCmaPhotoIndex(0);
        }
      }}>
        <DialogContent className="max-w-3xl" data-testid="dialog-cma-property">
          <VisuallyHidden>
            <DialogTitle>CMA Property Details</DialogTitle>
          </VisuallyHidden>
          {selectedCMAProperty && (() => {
            const cmaPhotos = selectedCMAProperty.photos || (selectedCMAProperty.imageUrl ? [selectedCMAProperty.imageUrl] : []);
            const displayThumbnails = cmaPhotos.slice(0, 6);
            const hasMorePhotos = cmaPhotos.length > 6;
            
            return (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedCMAProperty.address}</h2>
                    {selectedCMAProperty.mlsNumber && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3.5 w-3.5" />
                        MLS# {selectedCMAProperty.mlsNumber}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">
                    {selectedCMAProperty.distance.toFixed(1)} mi away
                  </Badge>
                </div>

                {/* Photo Gallery */}
                {cmaPhotos.length > 0 ? (
                  <div className="flex gap-3 h-64">
                    {/* Main Photo - 60% width */}
                    <div className="relative w-3/5 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={`/api/proxy-image?url=${encodeURIComponent(cmaPhotos[cmaPhotoIndex] || cmaPhotos[0])}`}
                        alt={selectedCMAProperty.address}
                        className="w-full h-full object-cover"
                        data-testid="cma-main-photo"
                      />
                      {/* Photo quality badge */}
                      <div className="absolute top-2 left-2 bg-green-600 text-white text-xs font-medium px-2 py-1 rounded">
                        HD
                      </div>
                      {/* Navigation arrows */}
                      {cmaPhotos.length > 1 && (
                        <>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/80 hover:bg-background"
                            onClick={() => setCmaPhotoIndex((prev) => (prev - 1 + cmaPhotos.length) % cmaPhotos.length)}
                            data-testid="cma-photo-prev"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/80 hover:bg-background"
                            onClick={() => setCmaPhotoIndex((prev) => (prev + 1) % cmaPhotos.length)}
                            data-testid="cma-photo-next"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {/* Photo counter */}
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {cmaPhotoIndex + 1} / {cmaPhotos.length}
                      </div>
                    </div>
                    
                    {/* Thumbnail Grid - 40% width, 2x3 */}
                    <div className="w-2/5 grid grid-cols-2 grid-rows-3 gap-1.5">
                      {displayThumbnails.map((photo, idx) => {
                        const isLastAndMore = idx === 5 && hasMorePhotos;
                        return (
                          <div
                            key={idx}
                            className={`relative rounded overflow-hidden cursor-pointer transition-opacity ${
                              cmaPhotoIndex === idx ? 'ring-2 ring-primary' : 'hover:opacity-80'
                            }`}
                            onClick={() => isLastAndMore ? setCmaFullscreenOpen(true) : setCmaPhotoIndex(idx)}
                            data-testid={`cma-thumbnail-${idx}`}
                          >
                            <img
                              src={`/api/proxy-image?url=${encodeURIComponent(photo)}`}
                              alt={`Photo ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {isLastAndMore && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-white text-sm font-medium">
                                  See all {cmaPhotos.length} photos
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Fill empty slots if less than 6 photos */}
                      {displayThumbnails.length < 6 && Array.from({ length: 6 - displayThumbnails.length }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="rounded bg-muted" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-48 rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No photos available</p>
                    </div>
                  </div>
                )}

                <div className="text-2xl font-bold text-primary">
                  {formatPrice(selectedCMAProperty.price)}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Bed className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-semibold">{selectedCMAProperty.bedrooms}</p>
                    <p className="text-xs text-muted-foreground">Bedrooms</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Bath className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-semibold">{selectedCMAProperty.bathrooms}</p>
                    <p className="text-xs text-muted-foreground">Bathrooms</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Square className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-semibold">
                      {typeof selectedCMAProperty.sqft === 'number' 
                        ? selectedCMAProperty.sqft.toLocaleString() 
                        : selectedCMAProperty.sqft}
                    </p>
                    <p className="text-xs text-muted-foreground">Sq Ft</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Days on Market
                    </span>
                    <span className="font-medium">{selectedCMAProperty.daysOnMarket}</span>
                  </div>
                  {selectedCMAProperty.status && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Status
                      </span>
                      <Badge className={getStatusBadgeStyle(selectedCMAProperty.status)}>{getStatusLabel(selectedCMAProperty.status)}</Badge>
                    </div>
                  )}
                  {selectedCMAProperty.listDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        List Date
                      </span>
                      <span className="font-medium">{formatDate(selectedCMAProperty.listDate)}</span>
                    </div>
                  )}
                  {selectedCMAProperty.sqft && selectedCMAProperty.price && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Price per Sq Ft
                      </span>
                      <span className="font-medium">
                        {formatPrice(
                          selectedCMAProperty.price / 
                          (typeof selectedCMAProperty.sqft === 'number' 
                            ? selectedCMAProperty.sqft 
                            : parseFloat(selectedCMAProperty.sqft) || 1)
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* CMA Fullscreen Photo Gallery */}
      {selectedCMAProperty && (() => {
        const cmaPhotos = selectedCMAProperty.photos || (selectedCMAProperty.imageUrl ? [selectedCMAProperty.imageUrl] : []);
        return (
          <Dialog open={cmaFullscreenOpen} onOpenChange={setCmaFullscreenOpen}>
            <DialogContent 
              className="w-[98vw] sm:max-w-[95vw] h-[95vh] sm:max-h-[95vh] p-0 bg-black/95 border-none [&>button]:bg-white/10 [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:active:bg-white/30 [&>button]:rounded-full [&>button]:opacity-100 [&>button]:p-1.5 sm:[&>button]:p-2 [&>button]:hover:opacity-100" 
              data-testid="dialog-cma-fullscreen"
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  setCmaPhotoIndex((prev) => (prev - 1 + cmaPhotos.length) % cmaPhotos.length);
                } else if (e.key === 'ArrowRight') {
                  setCmaPhotoIndex((prev) => (prev + 1) % cmaPhotos.length);
                }
              }}
            >
              <VisuallyHidden>
                <DialogTitle>CMA Photo Gallery</DialogTitle>
              </VisuallyHidden>
              <div className="relative w-full h-full flex items-center justify-center min-h-[70vh] sm:min-h-[80vh]">
                {/* Header with Photo Counter */}
                <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-10">
                  <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-black/60 text-white rounded-full text-xs sm:text-sm">
                    {cmaPhotoIndex + 1} of {cmaPhotos.length}
                  </div>
                  <h3 className="font-medium text-white text-sm mt-1 px-1 max-w-[200px] truncate">{selectedCMAProperty.address}</h3>
                </div>
                
                {/* Main Image */}
                <img
                  src={`/api/proxy-image?url=${encodeURIComponent(cmaPhotos[cmaPhotoIndex])}`}
                  alt={`Photo ${cmaPhotoIndex + 1}`}
                  className="max-w-full max-h-[65vh] sm:max-h-[80vh] object-contain touch-manipulation"
                  data-testid="img-cma-fullscreen-photo"
                />
                
                {/* Navigation Arrows */}
                {cmaPhotos.length > 1 && (
                  <>
                    <button
                      onClick={() => setCmaPhotoIndex((prev) => (prev - 1 + cmaPhotos.length) % cmaPhotos.length)}
                      className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-black/50 hover:bg-black/70 active:bg-black/80 rounded-full text-white transition-colors touch-manipulation z-40"
                      data-testid="button-cma-photo-prev"
                    >
                      <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
                    </button>
                    <button
                      onClick={() => setCmaPhotoIndex((prev) => (prev + 1) % cmaPhotos.length)}
                      className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-black/50 hover:bg-black/70 active:bg-black/80 rounded-full text-white transition-colors touch-manipulation z-40"
                      data-testid="button-cma-photo-next"
                    >
                      <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
                    </button>
                  </>
                )}
                
                {/* Thumbnail Strip at Bottom */}
                <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-black/50 rounded-lg max-w-[95vw] sm:max-w-[90vw] overflow-x-auto scrollbar-hide">
                  {cmaPhotos.map((photo, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCmaPhotoIndex(idx)}
                      className={`flex-shrink-0 w-12 h-9 sm:w-16 sm:h-12 rounded overflow-hidden border-2 transition-all touch-manipulation ${
                        idx === cmaPhotoIndex ? 'border-white ring-1 ring-white' : 'border-transparent opacity-60 hover:opacity-100 active:opacity-100'
                      }`}
                      data-testid={`button-cma-thumbnail-${idx}`}
                    >
                      <img
                        src={`/api/proxy-image?url=${encodeURIComponent(photo)}`}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Overview Property Photo Gallery Modal */}
      <Dialog open={overviewPhotoModalOpen} onOpenChange={setOverviewPhotoModalOpen}>
        <DialogContent 
          className="w-[98vw] sm:max-w-[95vw] h-[95vh] sm:max-h-[95vh] p-0 bg-black/95 border-none [&>button]:bg-white/10 [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:active:bg-white/30 [&>button]:rounded-full [&>button]:opacity-100 [&>button]:p-1.5 sm:[&>button]:p-2 [&>button]:hover:opacity-100" 
          data-testid="dialog-overview-photos"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              setOverviewPhotoIndex((prev) => (prev - 1 + overviewPhotos.length) % overviewPhotos.length);
            } else if (e.key === 'ArrowRight') {
              setOverviewPhotoIndex((prev) => (prev + 1) % overviewPhotos.length);
            }
          }}
        >
          <VisuallyHidden>
            <DialogTitle>Property Photos</DialogTitle>
          </VisuallyHidden>
          <div className="relative w-full h-full flex items-center justify-center min-h-[70vh] sm:min-h-[80vh]">
            {/* Header with Photo Counter */}
            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-10">
              <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-black/60 text-white rounded-full text-xs sm:text-sm">
                {overviewPhotoIndex + 1} of {overviewPhotos.length}
              </div>
              <h3 className="font-medium text-white text-sm mt-1 px-1 max-w-[200px] truncate">{transaction.propertyAddress}</h3>
            </div>
            
            {/* Main Image */}
            {overviewPhotos[overviewPhotoIndex] && (
              <img
                src={`/api/proxy-image?url=${encodeURIComponent(overviewPhotos[overviewPhotoIndex])}`}
                alt={`Photo ${overviewPhotoIndex + 1}`}
                className="max-w-full max-h-[65vh] sm:max-h-[80vh] object-contain touch-manipulation"
                data-testid="img-overview-fullscreen-photo"
              />
            )}
            
            {/* Navigation Arrows */}
            {overviewPhotos.length > 1 && (
              <>
                <button
                  onClick={() => setOverviewPhotoIndex((prev) => (prev - 1 + overviewPhotos.length) % overviewPhotos.length)}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-black/50 hover:bg-black/70 active:bg-black/80 rounded-full text-white transition-colors touch-manipulation z-40"
                  data-testid="button-overview-photo-prev"
                >
                  <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
                </button>
                <button
                  onClick={() => setOverviewPhotoIndex((prev) => (prev + 1) % overviewPhotos.length)}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-black/50 hover:bg-black/70 active:bg-black/80 rounded-full text-white transition-colors touch-manipulation z-40"
                  data-testid="button-overview-photo-next"
                >
                  <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
                </button>
              </>
            )}
            
            {/* Thumbnail Strip at Bottom */}
            <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-black/50 rounded-lg max-w-[95vw] sm:max-w-[90vw] overflow-x-auto scrollbar-hide">
              {overviewPhotos.map((photo, idx) => (
                <button
                  key={idx}
                  onClick={() => setOverviewPhotoIndex(idx)}
                  className={`flex-shrink-0 w-12 h-9 sm:w-16 sm:h-12 rounded overflow-hidden border-2 transition-all touch-manipulation ${
                    idx === overviewPhotoIndex ? 'border-white ring-1 ring-white' : 'border-transparent opacity-60 hover:opacity-100 active:opacity-100'
                  }`}
                  data-testid={`button-overview-thumbnail-${idx}`}
                >
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(photo)}`}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
