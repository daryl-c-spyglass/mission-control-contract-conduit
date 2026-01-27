interface PhotoWithInsights {
  url?: string;
  highResUrl?: string;
  largeUrl?: string;
  imageInsights?: {
    room?: string;
    description?: string;
    tags?: string[];
    isExterior?: boolean;
  };
}

interface SelectedPhotos {
  mainPhoto: string | null;
  kitchenPhoto: string | null;
  roomPhoto: string | null;
}

export function autoSelectPhotos(photos: PhotoWithInsights[]): SelectedPhotos {
  if (!photos || photos.length === 0) {
    return {
      mainPhoto: null,
      kitchenPhoto: null,
      roomPhoto: null,
    };
  }

  const getPhotoUrl = (photo: PhotoWithInsights): string => {
    return photo.highResUrl || photo.largeUrl || photo.url || '';
  };

  let mainPhoto: string | null = null;
  let kitchenPhoto: string | null = null;
  let roomPhoto: string | null = null;

  const usedIndices = new Set<number>();

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const insights = photo.imageInsights;
    const room = insights?.room?.toLowerCase() || '';
    const description = insights?.description?.toLowerCase() || '';
    const tags = insights?.tags?.map(t => t.toLowerCase()) || [];
    const isExterior = insights?.isExterior;

    if (!mainPhoto && (isExterior || room.includes('exterior') || room.includes('front') || tags.includes('exterior'))) {
      mainPhoto = getPhotoUrl(photo);
      usedIndices.add(i);
    }

    if (!kitchenPhoto && (room.includes('kitchen') || description.includes('kitchen') || tags.includes('kitchen'))) {
      kitchenPhoto = getPhotoUrl(photo);
      usedIndices.add(i);
    }

    if (!roomPhoto && !usedIndices.has(i) && (
      room.includes('living') || room.includes('bedroom') || room.includes('master') ||
      description.includes('living') || description.includes('bedroom') ||
      tags.includes('living room') || tags.includes('bedroom')
    )) {
      roomPhoto = getPhotoUrl(photo);
      usedIndices.add(i);
    }
  }

  if (!mainPhoto && photos.length > 0) {
    mainPhoto = getPhotoUrl(photos[0]);
    usedIndices.add(0);
  }

  if (!kitchenPhoto) {
    for (let i = 0; i < photos.length && !kitchenPhoto; i++) {
      if (!usedIndices.has(i)) {
        kitchenPhoto = getPhotoUrl(photos[i]);
        usedIndices.add(i);
      }
    }
  }

  if (!roomPhoto) {
    for (let i = 0; i < photos.length && !roomPhoto; i++) {
      if (!usedIndices.has(i)) {
        roomPhoto = getPhotoUrl(photos[i]);
        usedIndices.add(i);
      }
    }
  }

  return {
    mainPhoto,
    kitchenPhoto,
    roomPhoto,
  };
}

export function formatPrice(price: number | string | null): string {
  if (!price) return '';
  const num = typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) : price;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

export function formatAddress(transaction: any, mlsData: any): string {
  const parts = [
    mlsData?.streetNumber || transaction?.streetNumber,
    mlsData?.streetName || transaction?.streetName,
    mlsData?.streetSuffix || transaction?.streetSuffix,
  ].filter(Boolean).join(' ');

  const city = mlsData?.city || transaction?.city || '';
  const state = mlsData?.state || transaction?.state || 'TX';
  const zip = mlsData?.postalCode || transaction?.postalCode || '';

  if (parts && city) {
    return `${parts}, ${city}, ${state} ${zip}`.toUpperCase().trim();
  }
  return transaction?.address?.toUpperCase() || '';
}

export function formatNumber(num: number | string | null): string {
  if (!num) return '';
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
