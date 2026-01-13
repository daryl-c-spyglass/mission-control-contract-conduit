// Real Repliers MLS API integration using REPLIERS_API_KEY
import { isRentalOrLease, excludeRentals } from "../shared/lib/listings";

const REPLIERS_API_BASE = "https://api.repliers.io";
const REPLIERS_CDN_BASE = "https://cdn.repliers.io/";

async function repliersRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
  const apiKey = process.env.REPLIERS_API_KEY;
  if (!apiKey) {
    throw new Error("REPLIERS_API_KEY not configured");
  }

  const url = new URL(`${REPLIERS_API_BASE}${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "REPLIERS-API-KEY": apiKey,
      "Accept": "application/json",
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Repliers API error: ${response.status} ${response.statusText} - ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse Repliers response:", e);
    throw new Error(`Invalid JSON response from Repliers API`);
  }
}

export interface MLSListingData {
  mlsNumber: string;
  listPrice: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  
  // Property basics
  bedrooms: number;
  bathrooms: number;
  halfBaths: number;
  sqft: number;
  lotSize: string;
  yearBuilt: number;
  propertyType: string;
  propertyStyle: string;
  stories: number;
  garage: string;
  
  // Status & dates
  status: string;
  lastStatus: string;
  daysOnMarket: number;
  simpleDaysOnMarket: number | null;
  listDate: string;
  
  // Price history & sale info (from Repliers)
  originalPrice: number | null;
  soldPrice: number | null;
  soldDate: string | null;
  
  // External media links (internal use only - NOT for display per MLS/IDX/VOW compliance)
  virtualTourUrl: string | null;
  hasExternalMediaLinks: boolean;
  
  // Photo count
  photoCount: number;
  
  // Permissions (for display control)
  permissions?: {
    displayAddressOnInternet: boolean;
    displayPublic: boolean;
    displayInternetEntireListing: boolean;
  };
  
  // Neighborhood info
  neighborhood: string;
  
  // Description
  description: string;
  
  // Features arrays
  interiorFeatures: string[];
  exteriorFeatures: string[];
  appliances: string[];
  heatingCooling: string[];
  
  // Additional property features (from Repliers API)
  flooring: string[];
  roofMaterial: string;
  foundation: string;
  pool: string;
  parking: string[];
  waterSource: string;
  sewer: string;
  utilities: string[];
  constructionMaterials: string[];
  
  // Detail fields from Repliers details object
  viewType: string;
  patio: string;
  extras: string;
  subdivision: string;
  
  // Financial
  hoaFee: number | null;
  hoaFrequency: string;
  taxAmount: number | null;
  taxYear: number | null;
  
  // Listing agent info
  listingAgent: string;
  listingOffice: string;
  listingAgentPhone: string;
  listingAgentEmail: string;
  
  // Photos
  photos: string[];
  
  // Coordinates for mapping
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  
  // Legacy compatibility
  images: string[];
  agent?: {
    name: string;
    phone: string;
    email: string;
    brokerage: string;
  };
  
  // Raw API response for debugging (dev mode only)
  rawData?: any;
}

export interface CMAComparable {
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | string;
  daysOnMarket: number;
  distance: number;
  imageUrl?: string;
  photos?: string[];
  mlsNumber?: string;
  status?: string;
  listDate?: string;
}

function normalizeImageUrls(images: any): string[] {
  if (!images) return [];
  if (!Array.isArray(images)) return [];
  
  return images
    .map((img: any) => {
      // Handle object format {url: "..."} or {href: "..."}
      const rawUrl = typeof img === "string" 
        ? img 
        : (img?.mediaUrl || img?.url || img?.src || img?.href || img?.imageUrl || img?.Uri || "");
      
      if (!rawUrl || typeof rawUrl !== "string") return null;
      
      // Already a full URL
      if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        return rawUrl;
      }
      
      // Relative path - prepend CDN base URL
      if (rawUrl.length > 0) {
        // Remove leading slash if present
        const cleanPath = rawUrl.startsWith("/") ? rawUrl.slice(1) : rawUrl;
        return `${REPLIERS_CDN_BASE}${cleanPath}`;
      }
      
      return null;
    })
    .filter((url): url is string => url !== null);
}

function parseFeatures(features: any): string[] {
  if (!features) return [];
  if (Array.isArray(features)) return features.filter((f: any) => typeof f === "string");
  if (typeof features === "string") {
    return features.split(/[,;]/).map((f: string) => f.trim()).filter(Boolean);
  }
  return [];
}

function buildLotSize(listing: any): string {
  const rawArea = listing.lotSizeArea || listing.lotSize || listing.details?.lotSize;
  const units = listing.lotSizeUnits || listing.lotSizeUnit || "sqft";
  
  if (!rawArea) return "";
  
  const numericArea = typeof rawArea === "string" ? parseFloat(rawArea) : rawArea;
  if (isNaN(numericArea) || numericArea <= 0) {
    return typeof rawArea === "string" ? rawArea : "";
  }
  
  if (units === "acres" || numericArea < 1) {
    return `${numericArea} acres`;
  }
  return `${numericArea.toLocaleString()} ${units}`;
}

function buildGarage(listing: any): string {
  const spaces = listing.garageSpaces || listing.details?.garageSpaces || listing.garage || 0;
  const type = listing.garageType || listing.details?.garageType || "Attached";
  if (spaces > 0) {
    return `${spaces} Car ${type}`;
  }
  return "";
}

// Test function to search by specific address
export async function testRepliersAccess(): Promise<any> {
  const apiKey = process.env.REPLIERS_API_KEY;
  if (!apiKey) {
    throw new Error("REPLIERS_API_KEY not configured");
  }

  const response = await fetch("https://api.repliers.io/listings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "REPLIERS-API-KEY": apiKey,
    },
    body: JSON.stringify({
      streetName: "Spring Creek",
      streetNumber: "2204",
      city: "Austin",
      class: "residential",
      pageSize: 5,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    return { error: `API error: ${response.status}`, body: responseText };
  }

  try {
    const data = JSON.parse(responseText);
    
    return {
      status: response.status,
      count: data.count,
      listings: data.listings?.map((l: any) => ({
        mlsNumber: l.mlsNumber,
        address: l.address,
        listPrice: l.listPrice,
        status: l.status,
        boardId: l.boardId,
      })),
      fullResponse: data,
    };
  } catch (e) {
    return { error: "Failed to parse JSON", body: responseText };
  }
}

// Search for listing by MLS number using POST (fallback method)
async function searchByMLSNumber(mlsNumber: string): Promise<any> {
  const apiKey = process.env.REPLIERS_API_KEY;
  if (!apiKey) return null;
  
  const response = await fetch("https://api.repliers.io/listings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "REPLIERS-API-KEY": apiKey,
    },
    body: JSON.stringify({
      mlsNumber: mlsNumber,
      boardId: 53, // Unlock MLS (Austin)
      pageSize: 1,
    }),
  });
  
  if (!response.ok) {
    return null;
  }
  
  const data = await response.json();
  return data.listings?.[0] || null;
}

export async function fetchMLSListing(mlsNumber: string, boardId?: string): Promise<{ mlsData: MLSListingData; comparables: CMAComparable[] } | null> {
  try {
    // Add ACT prefix for Unlock MLS (Austin) if not already present
    const formattedMLS = mlsNumber.startsWith("ACT") ? mlsNumber : `ACT${mlsNumber}`;
    
    // Use direct listing endpoint: GET /listings/{mlsNumber}
    // Always include boardId=53 for Unlock MLS
    const params: Record<string, string> = {
      boardId: boardId || "53",
    };
    
    let data: any = null;
    try {
      data = await repliersRequest(`/listings/${formattedMLS}`, params);
    } catch (directError: any) {
      // Try searching by MLS number using POST as fallback
      data = await searchByMLSNumber(mlsNumber);
      if (!data) {
        // Try with ACT prefix
        data = await searchByMLSNumber(formattedMLS);
      }
    }
    
    if (!data) {
      return null;
    }
    
    let listing = data;
    if (data.listings && Array.isArray(data.listings)) {
      if (data.listings.length === 0) {
        return null;
      }
      listing = data.listings[0];
    }
    
    if (!listing) return null;

    const rawImages = listing.media || listing.images || listing.photos || [];
    const photos = normalizeImageUrls(rawImages);
    
    const addressParts = [];
    if (listing.address?.streetNumber) addressParts.push(listing.address.streetNumber);
    if (listing.address?.streetName) addressParts.push(listing.address.streetName);
    if (listing.address?.streetSuffix) addressParts.push(listing.address.streetSuffix);
    const streetAddress = addressParts.join(" ");
    const fullAddress = listing.address?.full || streetAddress;

    const heatingCooling: string[] = [];
    if (listing.heating) heatingCooling.push(...parseFeatures(listing.heating));
    if (listing.cooling) heatingCooling.push(...parseFeatures(listing.cooling));
    if (listing.details?.heating) heatingCooling.push(...parseFeatures(listing.details.heating));
    if (listing.details?.cooling) heatingCooling.push(...parseFeatures(listing.details.cooling));

    const result: MLSListingData = {
      mlsNumber: listing.mlsNumber || mlsNumber,
      listPrice: parseFloat(listing.listPrice) || 0,
      address: fullAddress,
      city: listing.address?.city || "",
      state: listing.address?.state || listing.address?.province || "",
      zipCode: listing.address?.zip || listing.address?.postalCode || "",
      
      bedrooms: listing.bedroomsTotal || listing.details?.numBedrooms || listing.beds || 0,
      bathrooms: listing.bathroomsFull || listing.details?.numBathrooms || listing.baths || 0,
      halfBaths: listing.bathroomsHalf || listing.details?.halfBaths || 0,
      sqft: listing.livingArea || listing.buildingAreaTotal || listing.details?.sqft || listing.sqft || 0,
      lotSize: buildLotSize(listing),
      yearBuilt: listing.yearBuilt || listing.details?.yearBuilt || 0,
      propertyType: listing.propertyType || listing.details?.propertyType || listing.class || "Residential",
      propertyStyle: listing.architecturalStyle || listing.details?.style || "",
      stories: listing.storiesTotal || listing.details?.stories || 1,
      garage: buildGarage(listing),
      
      status: listing.standardStatus || listing.mlsStatus || listing.status || listing.listingStatus || "",
      lastStatus: listing.lastStatus || "",
      daysOnMarket: listing.daysOnMarket || listing.dom || 0,
      simpleDaysOnMarket: listing.simpleDaysOnMarket ?? null,
      listDate: listing.listDate || listing.listingDate || "",
      
      // Price history & sale info
      originalPrice: listing.originalPrice != null ? parseFloat(listing.originalPrice) : null,
      soldPrice: listing.soldPrice != null ? parseFloat(listing.soldPrice) : null,
      soldDate: listing.soldDate || listing.timestamps?.closedDate || null,
      
      // External media links (internal use only - NOT for display per MLS/IDX/VOW compliance)
      virtualTourUrl: listing.details?.virtualTourUrl || listing.virtualTourUrl || null,
      hasExternalMediaLinks: !!(listing.details?.virtualTourUrl || listing.virtualTourUrl || listing.videoUrl || listing.matterportUrl),
      
      // Photo count
      photoCount: listing.photoCount || photos.length,
      
      // Permissions
      permissions: listing.permissions ? {
        displayAddressOnInternet: listing.permissions.displayAddressOnInternet === 'Y',
        displayPublic: listing.permissions.displayPublic === 'Y',
        displayInternetEntireListing: listing.permissions.displayInternetEntireListing === 'Y',
      } : undefined,
      
      // Neighborhood
      neighborhood: listing.address?.neighborhood || "",
      
      description: listing.publicRemarks || listing.privateRemarks || listing.remarks || listing.details?.description || "",
      
      // Property Features - extract from details.extras and other fields
      interiorFeatures: parseFeatures(listing.interiorFeatures || listing.details?.interiorFeatures || listing.details?.extras),
      exteriorFeatures: parseFeatures(listing.exteriorFeatures || listing.details?.exteriorFeatures || listing.details?.patio),
      appliances: parseFeatures(listing.appliances || listing.details?.appliances || listing.details?.extras),
      heatingCooling: Array.from(new Set([
        ...heatingCooling,
        ...(listing.details?.airConditioning ? parseFeatures(listing.details.airConditioning) : [])
      ])),
      
      // Additional property details from Repliers API
      flooring: parseFeatures(listing.flooring || listing.details?.flooringType),
      roofMaterial: listing.roofMaterial || listing.details?.roofMaterial || "",
      foundation: listing.foundation || listing.details?.foundationType || "",
      pool: listing.pool || listing.details?.swimmingPool || "",
      parking: parseFeatures(listing.parking || listing.details?.garage),
      waterSource: listing.waterSource || listing.details?.waterSource || "",
      sewer: listing.sewer || listing.details?.sewer || "",
      utilities: parseFeatures(listing.utilities),
      constructionMaterials: parseFeatures(listing.constructionMaterials || listing.details?.exteriorConstruction1),
      
      // Detail fields from Repliers details object
      viewType: listing.details?.viewType || "",
      patio: listing.details?.patio || "",
      extras: listing.details?.extras || "",
      subdivision: listing.subdivision || listing.details?.subdivision || "",
      
      hoaFee: listing.associationFee || listing.hoaFee || null,
      hoaFrequency: listing.associationFeeFrequency || listing.hoaFrequency || "Monthly",
      taxAmount: typeof listing.taxAnnualAmount === 'object' 
        ? listing.taxAnnualAmount?.annualAmount 
        : (listing.taxAnnualAmount || listing.taxes || null),
      taxYear: listing.taxYear || listing.taxAnnualAmount?.assessmentYear || null,
      
      listingAgent: listing.listAgentFullName || listing.agents?.[0]?.name || "",
      listingOffice: typeof listing.listOfficeName === 'object' 
        ? listing.listOfficeName?.name 
        : (listing.listOfficeName || 
           (typeof listing.office === 'object' ? listing.office?.name : listing.office) || 
           ""),
      listingAgentPhone: listing.listAgentPhone || listing.agents?.[0]?.phone || "",
      listingAgentEmail: listing.listAgentEmail || listing.agents?.[0]?.email || "",
      
      photos: photos,
      
      // Extract coordinates if available
      coordinates: (listing.map?.latitude && listing.map?.longitude) 
        ? { latitude: parseFloat(listing.map.latitude), longitude: parseFloat(listing.map.longitude) }
        : (listing.address?.latitude && listing.address?.longitude)
          ? { latitude: parseFloat(listing.address.latitude), longitude: parseFloat(listing.address.longitude) }
          : (listing.latitude && listing.longitude)
            ? { latitude: parseFloat(listing.latitude), longitude: parseFloat(listing.longitude) }
            : undefined,
      
      images: photos,
      agent: listing.agents?.[0] ? {
        name: listing.agents[0].name || "",
        phone: listing.agents[0].phone || "",
        email: listing.agents[0].email || "",
        brokerage: typeof listing.agents[0].brokerage === 'object' 
          ? listing.agents[0].brokerage?.name 
          : (listing.agents[0].brokerage || 
             (typeof listing.office === 'object' ? listing.office?.name : listing.office) || 
             ""),
      } : {
        name: listing.listAgentFullName || "",
        phone: listing.listAgentPhone || "",
        email: listing.listAgentEmail || "",
        brokerage: typeof listing.listOfficeName === 'object' 
          ? listing.listOfficeName?.name 
          : (listing.listOfficeName || ""),
      },
      
      // Store raw API response for dev mode debugging
      rawData: listing,
    };

    // Extract comparables from the listing response if available
    let comparables: CMAComparable[] = [];
    if (listing.comparables && Array.isArray(listing.comparables)) {
      comparables = listing.comparables.slice(0, 10).map((comp: any) => {
        const compAddressParts = [];
        if (comp.address?.streetNumber) compAddressParts.push(comp.address.streetNumber);
        if (comp.address?.streetName) compAddressParts.push(comp.address.streetName);
        if (comp.address?.streetSuffix) compAddressParts.push(comp.address.streetSuffix);
        const compStreetAddress = compAddressParts.join(" ");
        
        const compPhotos = normalizeImageUrls(comp.images || comp.media || comp.photos);
        return {
          address: comp.address?.full || compStreetAddress || "",
          price: parseFloat(comp.listPrice) || parseFloat(comp.soldPrice) || 0,
          bedrooms: comp.bedroomsTotal || comp.details?.numBedrooms || comp.beds || 0,
          bathrooms: comp.bathroomsFull || comp.details?.numBathrooms || comp.baths || 0,
          sqft: comp.livingArea || comp.buildingAreaTotal || comp.details?.sqft || comp.sqft || 0,
          daysOnMarket: comp.daysOnMarket || comp.simpleDaysOnMarket || comp.dom || 0,
          distance: comp.distance || 0,
          imageUrl: compPhotos[0] || undefined,
          photos: compPhotos,
          mlsNumber: comp.mlsNumber || "",
          status: comp.standardStatus || comp.status || "",
          listDate: comp.listDate || "",
        };
      });
    }

    return { mlsData: result, comparables };
  } catch (error) {
    console.error("Error fetching MLS listing:", error);
    return null;
  }
}

export async function fetchSimilarListings(mlsNumber: string, radius: number = 5): Promise<CMAComparable[]> {
  try {
    // Add ACT prefix for Austin/Unlock MLS if not already present
    const formattedMlsNumber = mlsNumber.toUpperCase().startsWith("ACT") 
      ? mlsNumber 
      : `ACT${mlsNumber}`;
    
    const data = await repliersRequest("/listings/similar", {
      mlsNumber: formattedMlsNumber,
      radius: radius.toString(),
      boardId: "53", // Unlock MLS board ID
      type: "Sale", // GLOBAL RENTAL EXCLUSION: Filter at API level
    });

    if (!data.listings || !Array.isArray(data.listings)) {
      return [];
    }

    // FAILSAFE: Apply local rental exclusion filter
    const filteredListings = data.listings.filter((listing: any) => !isRentalOrLease(listing));

    return filteredListings.slice(0, 10).map((listing: any) => {
      const addressParts = [];
      if (listing.address?.streetNumber) addressParts.push(listing.address.streetNumber);
      if (listing.address?.streetName) addressParts.push(listing.address.streetName);
      const streetAddress = addressParts.join(" ");
      
      const listingPhotos = normalizeImageUrls(listing.media || listing.images || listing.photos);
      return {
        address: listing.address?.full || streetAddress || "",
        price: parseFloat(listing.listPrice) || parseFloat(listing.soldPrice) || 0,
        bedrooms: listing.bedroomsTotal || listing.details?.numBedrooms || listing.beds || 0,
        bathrooms: listing.bathroomsFull || listing.details?.numBathrooms || listing.baths || 0,
        sqft: listing.livingArea || listing.details?.sqft || listing.sqft || 0,
        daysOnMarket: listing.daysOnMarket || listing.dom || 0,
        distance: listing.distance || 0,
        imageUrl: listingPhotos[0] || undefined,
        photos: listingPhotos,
        mlsNumber: listing.mlsNumber || "",
        status: listing.standardStatus || listing.status || "",
        listDate: listing.listDate || "",
      };
    });
  } catch (error) {
    console.error("Error fetching similar listings:", error);
    return [];
  }
}

export async function searchByAddress(address: string): Promise<MLSListingData | null> {
  try {
    const data = await repliersRequest("/listings", {
      address: address,
      resultsPerPage: "5",
      type: "Sale", // GLOBAL RENTAL EXCLUSION: Filter at API level
    });

    if (!data.listings || !Array.isArray(data.listings) || data.listings.length === 0) {
      return null;
    }

    // FAILSAFE: Apply local rental exclusion filter
    const filteredListings = data.listings.filter((listing: any) => !isRentalOrLease(listing));
    if (filteredListings.length === 0) {
      return null;
    }

    const listing = filteredListings[0];
    const result = await fetchMLSListing(listing.mlsNumber);
    return result?.mlsData || null;
  } catch (error) {
    console.error("Error searching by address:", error);
    return null;
  }
}

// Types for Image Insights photo selection
export interface SelectedPhoto {
  url: string;
  classification: string;
  quality: number;
  confidence: number;
}

export interface BestPhotosResult {
  selectedPhotos: SelectedPhoto[];
  allPhotosWithInsights: Array<{
    url: string;
    classification: string;
    quality: number;
    confidence: number;
  }>;
  hasImageInsights: boolean;
  selectionMethod: "ai" | "fallback";
}

// Priority categories for photo selection
const EXTERIOR_CATEGORIES = ["Front of Structure", "Back of Structure", "Exterior", "Pool", "Patio", "Deck"];
const KITCHEN_CATEGORIES = ["Kitchen"];
const LIVING_CATEGORIES = ["Living Room", "Family Room", "Dining Room", "Great Room"];

// Helper to extract image identifier from URL for matching
function extractImageId(url: string): string {
  // Extract filename like "IMG-ACT2572987_3.jpg" from various URL formats
  const match = url.match(/IMG-[A-Z0-9]+_\d+\.[a-z]+/i);
  return match ? match[0].toLowerCase() : url.toLowerCase();
}

// Select best photos for flyer using Image Insights
function selectBestPhotosForFlyer(
  imageInsights: any,
  images: string[],
  count: number = 3
): BestPhotosResult {
  if (!imageInsights?.images || imageInsights.images.length === 0) {
    // Fallback: return first N images
    return {
      selectedPhotos: images.slice(0, count).map(url => ({
        url,
        classification: "Unknown",
        quality: 0,
        confidence: 0,
      })),
      allPhotosWithInsights: images.map(url => ({
        url,
        classification: "Unknown",
        quality: 0,
        confidence: 0,
      })),
      hasImageInsights: false,
      selectionMethod: "fallback",
    };
  }

  // Build a map from image identifier to insight data
  const insightMap = new Map<string, { classification: string; quality: number; confidence: number }>();
  for (const img of imageInsights.images) {
    const imageUrl = img.image || img.url || "";
    const imageId = extractImageId(imageUrl);
    insightMap.set(imageId, {
      classification: img.classification?.imageOf || "Unknown",
      quality: img.quality?.quantitative || 0,
      confidence: img.classification?.prediction || 0,
    });
  }

  // Map the normalized images array to include insights using the actual URLs from images array
  const allPhotosWithInsights = images.map(url => {
    const imageId = extractImageId(url);
    const insight = insightMap.get(imageId);
    return {
      url, // Use the original normalized URL
      classification: insight?.classification || "Unknown",
      quality: insight?.quality || 0,
      confidence: insight?.confidence || 0,
    };
  });

  // Helper to find best photo from categories
  const findBestPhoto = (categories: string[], exclude: string[] = []): SelectedPhoto | null => {
    const candidates = allPhotosWithInsights.filter(
      p => categories.some(cat => 
        p.classification.toLowerCase().includes(cat.toLowerCase())
      ) && !exclude.includes(p.url)
    );
    
    if (candidates.length === 0) return null;
    
    // Sort by confidence first, then quality
    candidates.sort((a, b) => {
      if (Math.abs(b.confidence - a.confidence) > 0.05) {
        return b.confidence - a.confidence;
      }
      return b.quality - a.quality;
    });
    
    return candidates[0];
  };

  // Find best photo from remaining photos
  const findAnyBestPhoto = (exclude: string[]): SelectedPhoto | null => {
    const candidates = allPhotosWithInsights.filter(
      p => !exclude.includes(p.url) && p.confidence >= 0.5
    );
    
    if (candidates.length === 0) return null;
    
    candidates.sort((a, b) => b.quality - a.quality);
    return candidates[0];
  };

  const selectedPhotos: SelectedPhoto[] = [];
  const usedUrls: string[] = [];

  // Photo 1: Exterior (hero shot) - always try to get this first
  if (selectedPhotos.length < count) {
    const exteriorPhoto = findBestPhoto(EXTERIOR_CATEGORIES, usedUrls);
    if (exteriorPhoto) {
      selectedPhotos.push(exteriorPhoto);
      usedUrls.push(exteriorPhoto.url);
    }
  }

  // Photo 2: Kitchen (only if count > 1)
  if (selectedPhotos.length < count) {
    const kitchenPhoto = findBestPhoto(KITCHEN_CATEGORIES, usedUrls);
    if (kitchenPhoto) {
      selectedPhotos.push(kitchenPhoto);
      usedUrls.push(kitchenPhoto.url);
    }
  }

  // Photo 3: Living area (only if count > 2)
  if (selectedPhotos.length < count) {
    const livingPhoto = findBestPhoto(LIVING_CATEGORIES, usedUrls);
    if (livingPhoto) {
      selectedPhotos.push(livingPhoto);
      usedUrls.push(livingPhoto.url);
    }
  }

  // Fill remaining slots with best available photos
  while (selectedPhotos.length < count) {
    const nextBest = findAnyBestPhoto(usedUrls);
    if (!nextBest) break;
    selectedPhotos.push(nextBest);
    usedUrls.push(nextBest.url);
  }

  // If still not enough, add from original images array
  if (selectedPhotos.length < count) {
    for (const url of images) {
      if (selectedPhotos.length >= count) break;
      const fullUrl = url.startsWith("http") ? url : `https://cdn.repliers.io/${url}`;
      if (!usedUrls.includes(fullUrl)) {
        selectedPhotos.push({
          url: fullUrl,
          classification: "Unknown",
          quality: 0,
          confidence: 0,
        });
        usedUrls.push(fullUrl);
      }
    }
  }

  return {
    selectedPhotos,
    allPhotosWithInsights,
    hasImageInsights: true,
    selectionMethod: "ai",
  };
}

// Fetch best photos for a listing using Image Insights
export async function getBestPhotosForFlyer(mlsNumber: string, count: number = 3): Promise<BestPhotosResult> {
  try {
    const formattedMLS = mlsNumber.startsWith("ACT") ? mlsNumber : `ACT${mlsNumber}`;
    
    const data = await repliersRequest(`/listings/${formattedMLS}`, { boardId: "53" });
    
    if (!data) {
      return {
        selectedPhotos: [],
        allPhotosWithInsights: [],
        hasImageInsights: false,
        selectionMethod: "fallback",
      };
    }

    const listing = data.listings?.[0] || data;
    const rawImages = listing.media || listing.images || listing.photos || [];
    const photos = normalizeImageUrls(rawImages);
    const imageInsights = listing.imageInsights;

    return selectBestPhotosForFlyer(imageInsights, photos, count);
  } catch (error) {
    console.error("[BestPhotos] Error fetching best photos:", error);
    return {
      selectedPhotos: [],
      allPhotosWithInsights: [],
      hasImageInsights: false,
      selectionMethod: "fallback",
    };
  }
}

// Diagnostic function to check if Image Insights is enabled on the account
export async function checkImageInsights(mlsNumber: string): Promise<{
  mlsNumber: string;
  imageInsightsEnabled: boolean;
  totalImages: number;
  sampleClassifications: Array<{
    image: string;
    classification: string;
    confidence: number;
    quality: number;
  }>;
  coverImageTest?: {
    defaultFirstImage: string;
    withCoverImageParam: string;
    coverImageChanged: boolean;
  };
  rawImageInsightsPreview?: string;
}> {
  try {
    const formattedMLS = mlsNumber.startsWith("ACT") ? mlsNumber : `ACT${mlsNumber}`;
    
    // Fetch listing with default params
    const data = await repliersRequest(`/listings/${formattedMLS}`, { boardId: "53" });
    
    if (!data) {
      return {
        mlsNumber,
        imageInsightsEnabled: false,
        totalImages: 0,
        sampleClassifications: [],
      };
    }

    const listing = data.listings?.[0] || data;
    const rawImages = listing.media || listing.images || listing.photos || [];
    const photos = normalizeImageUrls(rawImages);
    const defaultFirstImage = photos[0] || "";

    // Check for imageInsights field
    const imageInsights = listing.imageInsights;
    
    if (imageInsights) {
      console.log("[ImageInsights] Found imageInsights field in response!");
      console.log("[ImageInsights] Raw preview (first 500 chars):", JSON.stringify(imageInsights).substring(0, 500));
      
      const images = imageInsights.images || [];
      const sampleClassifications = images.slice(0, 5).map((img: any) => ({
        image: img.url || img.image || "unknown",
        classification: img.classification || img.label || img.category || "unknown",
        confidence: img.confidence || img.score || 0,
        quality: img.quality || img.qualityScore || 0,
      }));

      return {
        mlsNumber,
        imageInsightsEnabled: true,
        totalImages: photos.length,
        sampleClassifications,
        rawImageInsightsPreview: JSON.stringify(imageInsights).substring(0, 500),
      };
    }

    // Image Insights not found - test coverImage parameter
    console.log("[ImageInsights] imageInsights field NOT present in response");
    console.log("[ImageInsights] Testing coverImage parameter...");
    
    let coverImageFirstPhoto = defaultFirstImage;
    try {
      const dataWithCover = await repliersRequest(`/listings/${formattedMLS}`, { 
        boardId: "53",
        coverImage: "exterior front"
      });
      
      const listingWithCover = dataWithCover.listings?.[0] || dataWithCover;
      const coverImages = listingWithCover.media || listingWithCover.images || listingWithCover.photos || [];
      const coverPhotos = normalizeImageUrls(coverImages);
      coverImageFirstPhoto = coverPhotos[0] || "";
      
      console.log("[ImageInsights] Default first image:", defaultFirstImage);
      console.log("[ImageInsights] With coverImage param:", coverImageFirstPhoto);
      console.log("[ImageInsights] Cover image changed:", coverImageFirstPhoto !== defaultFirstImage);
    } catch (e) {
      console.log("[ImageInsights] Error testing coverImage param:", e);
    }

    return {
      mlsNumber,
      imageInsightsEnabled: false,
      totalImages: photos.length,
      sampleClassifications: [],
      coverImageTest: {
        defaultFirstImage,
        withCoverImageParam: coverImageFirstPhoto,
        coverImageChanged: coverImageFirstPhoto !== defaultFirstImage,
      },
    };
  } catch (error) {
    console.error("[ImageInsights] Error checking image insights:", error);
    return {
      mlsNumber,
      imageInsightsEnabled: false,
      totalImages: 0,
      sampleClassifications: [],
    };
  }
}

export async function searchListings(params: {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  propertyType?: string;
  resultsPerPage?: number;
}): Promise<MLSListingData[]> {
  try {
    const queryParams: Record<string, string> = {};
    if (params.city) queryParams.city = params.city;
    if (params.minPrice) queryParams.minPrice = params.minPrice.toString();
    if (params.maxPrice) queryParams.maxPrice = params.maxPrice.toString();
    if (params.minBedrooms) queryParams.minBedrooms = params.minBedrooms.toString();
    if (params.propertyType) queryParams.propertyType = params.propertyType;
    queryParams.resultsPerPage = (params.resultsPerPage || 20).toString();
    
    // GLOBAL RENTAL EXCLUSION: Filter out leases at API level
    queryParams.type = "Sale";

    const data = await repliersRequest("/listings", queryParams);

    if (!data.listings || !Array.isArray(data.listings)) {
      return [];
    }

    // FAILSAFE: Apply local rental exclusion filter
    const filteredListings = data.listings.filter((listing: any) => !isRentalOrLease(listing));

    const results: MLSListingData[] = [];
    for (const listing of filteredListings.slice(0, 20)) {
      const result = await fetchMLSListing(listing.mlsNumber);
      if (result) {
        results.push(result.mlsData);
      }
    }
    return results;
  } catch (error) {
    console.error("Error searching listings:", error);
    return [];
  }
}
