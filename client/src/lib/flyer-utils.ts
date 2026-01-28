// Repliers API Photo Interface with imageInsights
interface PhotoWithInsights {
  url?: string;
  href?: string;
  highResUrl?: string;
  largeUrl?: string;
  Uri?: string;
  // Repliers API imageInsights format
  imageInsights?: {
    room?: string;
    description?: string;
    tags?: string[];
    isExterior?: boolean;
    classification?: {
      imageOf?: string;       // "Kitchen", "Living Room", "Front of Structure", etc.
      prediction?: number;    // Confidence 0.0 - 1.0 (e.g., 0.987 = 98.7%)
    };
    quality?: {
      qualitative?: string;   // "average", "above average", "excellent"
      quantitative?: number;  // Quality score 1.0 - 5.0
      score?: number;         // Legacy field
      brightness?: number;
      contrast?: number;
      sharpness?: number;
    };
  };
  // Alternate casing for some APIs
  ImageInsights?: {
    Classification?: {
      ImageOf?: string;
      Prediction?: number;
      Confidence?: number;
    };
    Quality?: {
      Qualitative?: string;
      Quantitative?: number;
      Score?: number;
    };
  };
}

interface SelectedPhotos {
  mainPhoto: string | null;
  kitchenPhoto: string | null;
  roomPhoto: string | null;
}

export interface PhotoSelectionInfo {
  classification: string;
  displayClassification: string; // Original casing for display
  confidence: number;           // 0-100 percentage
  quality: number;              // 0-100 percentage
  reason: string;
  isAISelected: boolean;        // Whether AI classification was used
  isMissing?: boolean;          // Whether this category had no matching photo
  categoryMismatch?: boolean;   // Whether the photo doesn't match expected category
  expectedCategory?: string;    // The expected category for this slot
}

export interface PhotoSelectionResult {
  mainPhoto: string | null;
  kitchenPhoto: string | null;
  roomPhoto: string | null;
  selectionInfo: {
    mainImage: PhotoSelectionInfo | null;
    kitchenImage: PhotoSelectionInfo | null;
    roomImage: PhotoSelectionInfo | null;
  };
  allPhotos: Array<{ 
    url: string; 
    classification: string;
    displayClassification: string;
    confidence: number;
    quality: number;
    index: number;
  }>;
  missingCategories: string[];
}

// Repliers classification values to match
const EXTERIOR_CLASSIFICATIONS = [
  'front of structure',
  'exterior',
  'back of structure',
  'aerial',
  'drone',
  'front',
  'exterior_front'
];

const KITCHEN_CLASSIFICATIONS = [
  'kitchen',
  'breakfast area',
  'breakfast',
  'breakfast room'
];

const ROOM_CLASSIFICATIONS = [
  'living room',
  'family room',
  'great room',
  'dining room',
  'bedroom',
  'primary bedroom',
  'master bedroom',
  'living',
  'family',
  'dining'
];

const CDN_BASE = 'https://cdn.repliers.io/';

// Export category classifications for external use
export const KITCHEN_MATCH_CLASSIFICATIONS = [
  'kitchen',
  'breakfast area',
  'breakfast',
  'breakfast room'
];

export const ROOM_MATCH_CLASSIFICATIONS = [
  'living room',
  'family room',
  'great room',
  'dining room',
  'bedroom',
  'primary bedroom',
  'master bedroom',
  'living',
  'family',
  'dining',
  'interior'
];

// Check if a classification matches expected category
export function doesClassificationMatchCategory(
  classification: string,
  expectedCategory: 'Kitchen' | 'Living Room' | 'Exterior'
): boolean {
  const normalizedClassification = classification.toLowerCase().trim();
  
  if (expectedCategory === 'Kitchen') {
    return KITCHEN_MATCH_CLASSIFICATIONS.some(cat => 
      normalizedClassification.includes(cat.toLowerCase())
    );
  }
  
  if (expectedCategory === 'Living Room') {
    return ROOM_MATCH_CLASSIFICATIONS.some(cat => 
      normalizedClassification.includes(cat.toLowerCase())
    );
  }
  
  if (expectedCategory === 'Exterior') {
    return EXTERIOR_CLASSIFICATIONS.some(cat => 
      normalizedClassification.includes(cat.toLowerCase())
    );
  }
  
  return false;
}

export function autoSelectPhotos(photos: PhotoWithInsights[]): SelectedPhotos {
  const result = autoSelectPhotosWithInfo(photos);
  return {
    mainPhoto: result.mainPhoto,
    kitchenPhoto: result.kitchenPhoto,
    roomPhoto: result.roomPhoto,
  };
}

export function autoSelectPhotosWithInfo(photos: (PhotoWithInsights | string)[]): PhotoSelectionResult {
  if (!photos || photos.length === 0) {
    return {
      mainPhoto: null,
      kitchenPhoto: null,
      roomPhoto: null,
      selectionInfo: { mainImage: null, kitchenImage: null, roomImage: null },
      allPhotos: [],
      missingCategories: ['Exterior', 'Kitchen', 'Living Room'],
    };
  }

  const getPhotoUrl = (photo: PhotoWithInsights | string): string => {
    if (typeof photo === 'string') {
      // Handle relative paths from Repliers
      if (photo && !photo.startsWith('http')) {
        return `${CDN_BASE}${photo}`;
      }
      return photo;
    }
    let url = photo.href || photo.highResUrl || photo.largeUrl || photo.url || photo.Uri || '';
    // Handle relative paths
    if (url && !url.startsWith('http')) {
      url = `${CDN_BASE}${url}`;
    }
    return url;
  };

  const getClassification = (photo: PhotoWithInsights | string): { raw: string; display: string } => {
    if (typeof photo === 'string') {
      return { raw: 'unknown', display: 'Unknown' };
    }
    
    const classification = 
      photo.imageInsights?.classification?.imageOf ||
      photo.ImageInsights?.Classification?.ImageOf ||
      photo.imageInsights?.room ||
      '';
    
    return {
      raw: classification.toLowerCase(),
      display: classification || 'Unknown'
    };
  };

  const getConfidence = (photo: PhotoWithInsights | string): number => {
    if (typeof photo === 'string') {
      return 0;
    }
    
    // Repliers uses 'prediction' field with 0.0-1.0 scale
    const prediction = 
      photo.imageInsights?.classification?.prediction ||
      photo.ImageInsights?.Classification?.Prediction ||
      photo.ImageInsights?.Classification?.Confidence ||
      0;
    
    // Convert to 0-100 scale
    return Math.round(prediction * 100);
  };

  const getQualityScore = (photo: PhotoWithInsights | string): number => {
    if (typeof photo === 'string') {
      return 50;
    }
    
    // Repliers uses 'quantitative' field with 1.0-5.0 scale
    const quantitative = 
      photo.imageInsights?.quality?.quantitative ||
      photo.ImageInsights?.Quality?.Quantitative ||
      photo.imageInsights?.quality?.score ||
      photo.ImageInsights?.Quality?.Score ||
      null;
    
    if (quantitative !== null) {
      // Convert 1.0-5.0 scale to 0-100 percentage
      return Math.round(((quantitative - 1) / 4) * 100);
    }
    
    return 50; // Default quality
  };

  // Normalize all photos with classification, confidence, and quality
  const normalizedPhotos = photos.map((photo, index) => {
    const classInfo = getClassification(photo);
    return {
      url: getPhotoUrl(photo),
      classification: classInfo.raw,
      displayClassification: classInfo.display,
      confidence: getConfidence(photo),
      quality: getQualityScore(photo),
      index,
    };
  }).filter(p => p.url);

  // Sort by quality (highest first)
  const sortedByQuality = [...normalizedPhotos].sort((a, b) => b.quality - a.quality);

  const missingCategories: string[] = [];

  // ========== MAIN PHOTO ==========
  // Priority: Front of Structure > Exterior > Aerial > Highest Quality
  // Only use AI-classified photos with >= 70% confidence for "AI Selected" status
  let mainPhotoData = sortedByQuality.find(p =>
    EXTERIOR_CLASSIFICATIONS.some(type => p.classification.includes(type)) &&
    p.confidence >= 70
  );
  
  let mainPhotoIsAISelected = !!mainPhotoData;
  
  // Fallback: Any exterior photo regardless of confidence (mark as not AI-selected)
  if (!mainPhotoData) {
    const lowConfidenceExterior = sortedByQuality.find(p =>
      EXTERIOR_CLASSIFICATIONS.some(type => p.classification.includes(type))
    );
    
    if (lowConfidenceExterior) {
      mainPhotoData = lowConfidenceExterior;
      mainPhotoIsAISelected = false;
      // Low-confidence exterior still counts as missing the proper exterior category
      missingCategories.push('Exterior');
      console.log(`[Flyer AI] Main Photo: Using low-confidence exterior "${mainPhotoData.displayClassification}" (${mainPhotoData.confidence}% < 70% threshold)`);
    }
  }
  
  // Final fallback: Highest quality photo (no exterior found at all)
  if (!mainPhotoData) {
    mainPhotoData = sortedByQuality[0];
    mainPhotoIsAISelected = false;
    missingCategories.push('Exterior');
    console.log('[Flyer AI] Main Photo: No exterior found, using highest quality photo');
  } else if (mainPhotoIsAISelected) {
    console.log(`[Flyer AI] Main Photo: Selected "${mainPhotoData.displayClassification}" (${mainPhotoData.confidence}% confidence)`);
  }

  // ========== KITCHEN PHOTO ==========
  const kitchenPhotos = normalizedPhotos
    .filter(p =>
      KITCHEN_CLASSIFICATIONS.some(type => p.classification.includes(type)) &&
      p.url !== mainPhotoData?.url
    )
    .sort((a, b) => b.confidence - a.confidence);

  let kitchenPhotoData = kitchenPhotos[0] || null;
  let kitchenPhotoIsAISelected = !!kitchenPhotoData && kitchenPhotoData.confidence > 0;

  if (!kitchenPhotoData) {
    missingCategories.push('Kitchen');
    console.log('[Flyer AI] Kitchen Photo: No kitchen photo found in MLS images');
  } else if (kitchenPhotoIsAISelected) {
    console.log(`[Flyer AI] Kitchen Photo: Selected "${kitchenPhotoData.displayClassification}" (${kitchenPhotoData.confidence}% confidence)`);
  }

  // ========== ROOM PHOTO ==========
  const usedUrls = [mainPhotoData?.url, kitchenPhotoData?.url].filter(Boolean);
  
  const roomPhotos = normalizedPhotos
    .filter(p =>
      ROOM_CLASSIFICATIONS.some(type => p.classification.includes(type)) &&
      !usedUrls.includes(p.url)
    )
    .sort((a, b) => {
      // Sort by room type priority first, then confidence
      const aPriority = ROOM_CLASSIFICATIONS.findIndex(t => a.classification.includes(t));
      const bPriority = ROOM_CLASSIFICATIONS.findIndex(t => b.classification.includes(t));
      if (aPriority !== -1 && bPriority !== -1 && aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return b.confidence - a.confidence;
    });

  let roomPhotoData = roomPhotos[0] || null;
  let roomPhotoIsAISelected = !!roomPhotoData && roomPhotoData.confidence > 0;

  if (!roomPhotoData) {
    missingCategories.push('Living Room');
    console.log('[Flyer AI] Room Photo: No living/family/dining room photo found in MLS images');
  } else if (roomPhotoIsAISelected) {
    console.log(`[Flyer AI] Room Photo: Selected "${roomPhotoData.displayClassification}" (${roomPhotoData.confidence}% confidence)`);
  }

  // Build selection info with confidence and AI selection status
  const buildSelectionInfo = (
    photo: typeof normalizedPhotos[0] | null,
    type: 'main' | 'kitchen' | 'room',
    isAISelected: boolean
  ): PhotoSelectionInfo | null => {
    if (!photo) return null;

    // Map type to expected category
    const expectedCategoryMap: Record<string, 'Kitchen' | 'Living Room' | 'Exterior'> = {
      'main': 'Exterior',
      'kitchen': 'Kitchen',
      'room': 'Living Room',
    };
    const expectedCategory = expectedCategoryMap[type];
    
    // Check if photo matches expected category
    const matchesCategory = doesClassificationMatchCategory(photo.classification, expectedCategory);
    
    // Consider it a mismatch if classification doesn't match OR confidence is low
    const categoryMismatch = !matchesCategory || photo.confidence < 50;

    let reason = '';
    if (type === 'main') {
      reason = isAISelected 
        ? `AI detected: ${photo.displayClassification}` 
        : `Highest quality image (${photo.quality}%)`;
    } else if (type === 'kitchen') {
      reason = matchesCategory
        ? `AI detected: ${photo.displayClassification}`
        : `Selected from available photos (not a kitchen photo)`;
    } else {
      reason = matchesCategory 
        ? `AI detected: ${photo.displayClassification}`
        : `Selected from available photos (not a room photo)`;
    }

    return {
      classification: photo.classification,
      displayClassification: photo.displayClassification,
      confidence: photo.confidence,
      quality: photo.quality,
      reason,
      isAISelected: isAISelected && matchesCategory,
      categoryMismatch,
      expectedCategory,
    };
  };

  return {
    mainPhoto: mainPhotoData?.url || null,
    kitchenPhoto: kitchenPhotoData?.url || null,
    roomPhoto: roomPhotoData?.url || null,
    selectionInfo: {
      mainImage: buildSelectionInfo(mainPhotoData, 'main', mainPhotoIsAISelected),
      kitchenImage: buildSelectionInfo(kitchenPhotoData, 'kitchen', kitchenPhotoIsAISelected),
      roomImage: buildSelectionInfo(roomPhotoData, 'room', roomPhotoIsAISelected),
    },
    allPhotos: normalizedPhotos,
    missingCategories,
  };
}

export function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined || price === '') return '';
  // Handle JSON-encoded strings (with extra quotes) and regular strings
  let cleaned = typeof price === 'string' ? price.replace(/^["']|["']$/g, '').replace(/[^0-9.]/g, '') : String(price);
  const num = parseFloat(cleaned);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

// Helper to clean JSON-encoded string values
function cleanJsonString(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return str.replace(/^["']|["']$/g, '').trim();
}

export function formatAddress(transaction: any, mlsData: any): string {
  // First check for pre-formatted full address fields (most reliable)
  const preformattedAddress = 
    cleanJsonString(mlsData?.fullAddress) ||
    cleanJsonString(mlsData?.unparsedAddress) ||
    cleanJsonString(mlsData?.address?.fullAddress) ||
    cleanJsonString(mlsData?.address?.full) ||
    (typeof mlsData?.address === 'string' ? cleanJsonString(mlsData.address) : '');
  
  if (preformattedAddress && preformattedAddress.trim()) {
    return preformattedAddress.toUpperCase().trim();
  }
  
  // Build address from component parts (Repliers API format)
  const addr = (typeof mlsData?.address === 'object' && mlsData?.address) ? mlsData.address : mlsData || {};
  
  const streetNumber = cleanJsonString(mlsData?.streetNumber || addr?.streetNumber || transaction?.streetNumber);
  const streetDirection = cleanJsonString(mlsData?.streetDirection || addr?.streetDirection || mlsData?.streetDir || addr?.streetDir);
  const streetName = cleanJsonString(mlsData?.streetName || addr?.streetName || transaction?.streetName);
  const streetSuffix = cleanJsonString(mlsData?.streetSuffix || addr?.streetSuffix || mlsData?.streetType || addr?.streetType);
  const unitNumber = cleanJsonString(mlsData?.unitNumber || addr?.unitNumber || mlsData?.unit || addr?.unit);
  
  // Build street address with direction (normalize direction abbreviations)
  const dirNormalized = streetDirection ? streetDirection.replace(/\./g, '').toUpperCase() : '';
  const streetParts = [streetNumber, dirNormalized, streetName, streetSuffix].filter(Boolean).join(' ');
  const fullStreet = unitNumber ? `${streetParts}, Unit ${unitNumber}` : streetParts;

  const city = cleanJsonString(mlsData?.city || addr?.city || transaction?.city);
  const state = cleanJsonString(mlsData?.state || addr?.state || mlsData?.stateOrProvince || addr?.stateOrProvince || mlsData?.province || transaction?.state) || 'TX';
  const zip = cleanJsonString(mlsData?.postalCode || addr?.postalCode || mlsData?.postalCodeNumber || addr?.postalCodeNumber || mlsData?.zip || transaction?.postalCode);

  if (fullStreet && city) {
    return `${fullStreet}, ${city}, ${state} ${zip}`.toUpperCase().trim();
  }
  
  // Final fallback to transaction address
  const fallbackAddress = cleanJsonString(transaction?.propertyAddress || transaction?.address);
  return fallbackAddress.toUpperCase();
}

export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined || num === '') return '';
  // Handle JSON-encoded strings (with extra quotes) and regular strings
  let cleaned = typeof num === 'string' ? num.replace(/^["']|["']$/g, '').replace(/[^0-9.]/g, '') : String(num);
  const n = parseFloat(cleaned);
  if (isNaN(n)) return '';
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export function generateDefaultHeadline(transaction: any, mlsData: any): string {
  const city = mlsData?.city || transaction?.city || '';
  const propertyType = mlsData?.propertyType || 'Property';
  if (city) {
    return `Prime Opportunity in ${city}`;
  }
  return `Beautiful ${propertyType}`;
}
