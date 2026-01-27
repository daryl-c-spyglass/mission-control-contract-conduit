interface PhotoWithInsights {
  url?: string;
  href?: string;
  highResUrl?: string;
  largeUrl?: string;
  Uri?: string;
  imageInsights?: {
    room?: string;
    description?: string;
    tags?: string[];
    isExterior?: boolean;
    classification?: {
      imageOf?: string;
      confidence?: number;
    };
    quality?: {
      score?: number;
      brightness?: number;
      contrast?: number;
      sharpness?: number;
    };
  };
  ImageInsights?: {
    Classification?: {
      ImageOf?: string;
      Confidence?: number;
    };
    Quality?: {
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
  quality: number;
  reason: string;
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
  allPhotos: Array<{ url: string; classification: string; quality: number }>;
}

export function autoSelectPhotos(photos: PhotoWithInsights[]): SelectedPhotos {
  const result = autoSelectPhotosWithInfo(photos);
  return {
    mainPhoto: result.mainPhoto,
    kitchenPhoto: result.kitchenPhoto,
    roomPhoto: result.roomPhoto,
  };
}

export function autoSelectPhotosWithInfo(photos: PhotoWithInsights[]): PhotoSelectionResult {
  if (!photos || photos.length === 0) {
    return {
      mainPhoto: null,
      kitchenPhoto: null,
      roomPhoto: null,
      selectionInfo: { mainImage: null, kitchenImage: null, roomImage: null },
      allPhotos: [],
    };
  }

  const getPhotoUrl = (photo: PhotoWithInsights): string => {
    return photo.href || photo.highResUrl || photo.largeUrl || photo.url || photo.Uri || '';
  };

  const getClassification = (photo: PhotoWithInsights): string => {
    return (
      photo.imageInsights?.classification?.imageOf ||
      photo.ImageInsights?.Classification?.ImageOf ||
      photo.imageInsights?.room ||
      'unknown'
    ).toLowerCase();
  };

  const getQualityScore = (photo: PhotoWithInsights): number => {
    return (
      photo.imageInsights?.quality?.score ||
      photo.ImageInsights?.Quality?.Score ||
      50
    );
  };

  // Normalize photos with classification and quality
  const normalizedPhotos = photos.map((photo, index) => ({
    url: getPhotoUrl(photo),
    classification: getClassification(photo),
    quality: getQualityScore(photo),
    index,
  })).filter(p => p.url);

  // Sort by quality (highest first)
  const sortedByQuality = [...normalizedPhotos].sort((a, b) => b.quality - a.quality);

  // Main photo priorities: exterior_front > aerial > exterior_* > highest quality
  const mainOptions = ['exterior_front', 'exterior', 'front', 'aerial', 'drone'];
  let mainPhotoData = sortedByQuality.find(p =>
    mainOptions.some(opt => p.classification.includes(opt))
  );
  if (!mainPhotoData) {
    mainPhotoData = sortedByQuality[0];
  }

  // Kitchen photo: kitchen > breakfast_area
  const kitchenOptions = ['kitchen', 'breakfast'];
  let kitchenPhotoData = sortedByQuality.find(p =>
    kitchenOptions.some(opt => p.classification.includes(opt)) &&
    p.url !== mainPhotoData?.url
  );
  if (!kitchenPhotoData && sortedByQuality.length > 1) {
    kitchenPhotoData = sortedByQuality.find(p => p.url !== mainPhotoData?.url);
  }

  // Room photo: living_room > family_room > master_bedroom > bedroom
  const roomOptions = ['living', 'family', 'bedroom', 'master', 'dining', 'great_room'];
  const usedUrls = [mainPhotoData?.url, kitchenPhotoData?.url].filter(Boolean);
  let roomPhotoData = sortedByQuality.find(p =>
    roomOptions.some(opt => p.classification.includes(opt)) &&
    !usedUrls.includes(p.url)
  );
  if (!roomPhotoData) {
    roomPhotoData = sortedByQuality.find(p => !usedUrls.includes(p.url));
  }

  // Build selection info for tooltips
  const buildReason = (photo: typeof normalizedPhotos[0] | undefined, type: 'main' | 'kitchen' | 'room'): string => {
    if (!photo) return '';
    if (type === 'main') {
      return mainOptions.some(opt => photo.classification.includes(opt))
        ? `Best exterior shot (${photo.classification})`
        : `Highest quality image (${photo.quality}%)`;
    }
    if (type === 'kitchen') {
      return kitchenOptions.some(opt => photo.classification.includes(opt))
        ? `Kitchen area detected (${photo.quality}%)`
        : `Second best quality (${photo.quality}%)`;
    }
    return roomOptions.some(opt => photo.classification.includes(opt))
      ? `Living area detected (${photo.classification})`
      : `High quality interior (${photo.quality}%)`;
  };

  return {
    mainPhoto: mainPhotoData?.url || null,
    kitchenPhoto: kitchenPhotoData?.url || null,
    roomPhoto: roomPhotoData?.url || null,
    selectionInfo: {
      mainImage: mainPhotoData ? {
        classification: mainPhotoData.classification,
        quality: mainPhotoData.quality,
        reason: buildReason(mainPhotoData, 'main'),
      } : null,
      kitchenImage: kitchenPhotoData ? {
        classification: kitchenPhotoData.classification,
        quality: kitchenPhotoData.quality,
        reason: buildReason(kitchenPhotoData, 'kitchen'),
      } : null,
      roomImage: roomPhotoData ? {
        classification: roomPhotoData.classification,
        quality: roomPhotoData.quality,
        reason: buildReason(roomPhotoData, 'room'),
      } : null,
    },
    allPhotos: normalizedPhotos,
  };
}

export function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined || price === '') return '';
  const num = typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) : price;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

export function formatAddress(transaction: any, mlsData: any): string {
  // First check for pre-formatted full address fields (most reliable)
  const preformattedAddress = 
    mlsData?.fullAddress ||
    mlsData?.unparsedAddress ||
    mlsData?.address?.fullAddress ||
    mlsData?.address?.full ||
    (typeof mlsData?.address === 'string' ? mlsData.address : null);
  
  if (preformattedAddress && typeof preformattedAddress === 'string' && preformattedAddress.trim()) {
    return preformattedAddress.toUpperCase().trim();
  }
  
  // Build address from component parts (Repliers API format)
  const addr = (typeof mlsData?.address === 'object' && mlsData?.address) ? mlsData.address : mlsData || {};
  
  const streetNumber = mlsData?.streetNumber || addr?.streetNumber || transaction?.streetNumber || '';
  const streetDirection = mlsData?.streetDirection || addr?.streetDirection || mlsData?.streetDir || addr?.streetDir || '';
  const streetName = mlsData?.streetName || addr?.streetName || transaction?.streetName || '';
  const streetSuffix = mlsData?.streetSuffix || addr?.streetSuffix || mlsData?.streetType || addr?.streetType || '';
  const unitNumber = mlsData?.unitNumber || addr?.unitNumber || mlsData?.unit || addr?.unit || '';
  
  // Build street address with direction (normalize direction abbreviations)
  const dirNormalized = streetDirection ? streetDirection.replace(/\./g, '').toUpperCase() : '';
  const streetParts = [streetNumber, dirNormalized, streetName, streetSuffix].filter(Boolean).join(' ');
  const fullStreet = unitNumber ? `${streetParts}, Unit ${unitNumber}` : streetParts;

  const city = mlsData?.city || addr?.city || transaction?.city || '';
  const state = mlsData?.state || addr?.state || mlsData?.stateOrProvince || addr?.stateOrProvince || mlsData?.province || transaction?.state || 'TX';
  const zip = mlsData?.postalCode || addr?.postalCode || mlsData?.postalCodeNumber || addr?.postalCodeNumber || mlsData?.zip || transaction?.postalCode || '';

  if (fullStreet && city) {
    return `${fullStreet}, ${city}, ${state} ${zip}`.toUpperCase().trim();
  }
  
  // Final fallback to transaction address
  const fallbackAddress = transaction?.propertyAddress || transaction?.address || '';
  return typeof fallbackAddress === 'string' ? fallbackAddress.toUpperCase() : '';
}

export function formatNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined || num === '') return '';
  const n = typeof num === 'string' ? parseFloat(num.replace(/[^0-9.]/g, '')) : num;
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
