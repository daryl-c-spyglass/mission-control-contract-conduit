// Real Repliers MLS API integration using REPLIERS_API_KEY
import { isRentalOrLease, excludeRentals } from "../shared/lib/listings";
import { normalizedAcres, normalizedLotSquareFeet, calculatePricePerAcre, buildLotSizeData } from "./utils/lotSize";

const REPLIERS_API_BASE = "https://api.repliers.io";
const REPLIERS_CDN_BASE = "https://cdn.repliers.io/";

interface RepliersRequestOptions {
  allow404?: boolean;
  context?: string;
}

async function repliersRequest(
  endpoint: string, 
  params?: Record<string, string>,
  options?: RepliersRequestOptions
): Promise<any> {
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
    if (response.status === 404 && options?.allow404) {
      const context = options.context || 'unknown';
      console.warn(`[Repliers] No data found for ${context} (404 response)`);
      return null;
    }
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
  lot: {
    acres: number | null;
    squareFeet: number | null;
    size: string | null;
  };
  lotSizeAcres: number | null;
  lotSizeSquareFeet: number | null;
  pricePerAcre: number | null;
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
  
  // Image Insights from Repliers AI for photo classification
  imageInsights?: {
    images?: Array<{
      image?: string;
      url?: string;
      classification?: {
        imageOf?: string;
        prediction?: number;
      };
      quality?: {
        qualitative?: string;
        quantitative?: number;
      };
    }>;
  } | null;
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
  map?: {
    latitude: number;
    longitude: number;
  };
  lot?: {
    acres: number | null;
    squareFeet: number | null;
    size: string | null;
  };
  lotSizeAcres?: number | null;
  lotSizeSquareFeet?: number | null;
  pricePerAcre?: number | null;
  soldPrice?: number | null;
  listPrice?: number;
  type?: string;
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
      lot: buildLotSizeData(listing),
      lotSizeAcres: normalizedAcres(listing),
      lotSizeSquareFeet: normalizedLotSquareFeet(listing),
      pricePerAcre: calculatePricePerAcre(
        listing.soldPrice ? parseFloat(listing.soldPrice) : parseFloat(listing.listPrice) || 0,
        normalizedAcres(listing)
      ),
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
      
      // Store imageInsights for AI photo classification in Flyer Generator
      imageInsights: listing.imageInsights || null,
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
        const compLat = comp.map?.latitude || comp.address?.latitude || comp.latitude;
        const compLng = comp.map?.longitude || comp.address?.longitude || comp.longitude;
        const lotData = buildLotSizeData(comp);
        const listPrice = parseFloat(comp.listPrice) || 0;
        const soldPrice = comp.soldPrice ? parseFloat(comp.soldPrice) : null;
        const effectivePrice = soldPrice || listPrice;
        
        return {
          address: comp.address?.full || compStreetAddress || "",
          price: effectivePrice,
          listPrice: listPrice,
          soldPrice: soldPrice,
          bedrooms: comp.bedroomsTotal || comp.details?.numBedrooms || comp.beds || 0,
          bathrooms: comp.bathroomsFull || comp.details?.numBathrooms || comp.baths || 0,
          sqft: comp.livingArea || comp.buildingAreaTotal || comp.details?.sqft || comp.sqft || 0,
          daysOnMarket: comp.daysOnMarket || comp.simpleDaysOnMarket || comp.dom || 0,
          distance: comp.distance || 0,
          imageUrl: compPhotos[0] || undefined,
          photos: compPhotos,
          mlsNumber: comp.mlsNumber || "",
          status: comp.standardStatus || comp.status || "",
          lastStatus: comp.lastStatus || "",
          listDate: comp.listDate || "",
          soldDate: comp.soldDate || comp.closeDate || null,
          map: (compLat && compLng) ? {
            latitude: parseFloat(compLat),
            longitude: parseFloat(compLng),
          } : undefined,
          lot: lotData,
          lotSizeAcres: lotData.acres,
          lotSizeSquareFeet: lotData.squareFeet,
          pricePerAcre: calculatePricePerAcre(effectivePrice, lotData.acres),
          type: 'Sale',
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
    
    const data = await repliersRequest(
      "/listings/similar", 
      {
        mlsNumber: formattedMlsNumber,
        radius: radius.toString(),
        boardId: "53", // Unlock MLS board ID
        type: "Sale", // GLOBAL RENTAL EXCLUSION: Filter at API level
      },
      { 
        allow404: true, 
        context: `similar listings for MLS# ${formattedMlsNumber}` 
      }
    );

    if (!data || !data.listings || !Array.isArray(data.listings)) {
      return [];
    }

    // FAILSAFE: Apply local rental exclusion filter
    const filteredListings = data.listings.filter((listing: any) => !isRentalOrLease(listing));

    return filteredListings.slice(0, 10).map((listing: any) => {
      // Build address from component parts if full/streetAddress not available
      const addressParts: string[] = [];
      if (listing.address?.streetNumber) addressParts.push(listing.address.streetNumber);
      if (listing.address?.streetName) addressParts.push(listing.address.streetName);
      if (listing.address?.streetSuffix) addressParts.push(listing.address.streetSuffix);
      const builtAddress = addressParts.join(" ");
      const fullAddress = listing.address?.full || listing.address?.streetAddress || builtAddress;
      // Add city/state if we have them
      const city = listing.address?.city;
      const state = listing.address?.state;
      const displayAddress = fullAddress && city && state 
        ? `${fullAddress}, ${city}, ${state}`
        : fullAddress || '';
      
      const listingPhotos = normalizeImageUrls(listing.media || listing.images || listing.photos);
      const listingLat = listing.map?.latitude || listing.address?.latitude || listing.latitude;
      const listingLng = listing.map?.longitude || listing.address?.longitude || listing.longitude;
      const lotData = buildLotSizeData(listing);
      const listPrice = parseFloat(listing.listPrice) || 0;
      const soldPrice = listing.soldPrice ? parseFloat(listing.soldPrice) : null;
      const effectivePrice = soldPrice || listPrice;
      
      return {
        address: displayAddress,
        price: effectivePrice,
        listPrice: listPrice,
        soldPrice: soldPrice,
        bedrooms: listing.bedroomsTotal || listing.details?.numBedrooms || listing.beds || 0,
        bathrooms: listing.bathroomsFull || listing.details?.numBathrooms || listing.baths || 0,
        sqft: listing.livingArea || listing.details?.sqft || listing.sqft || 0,
        daysOnMarket: listing.daysOnMarket || listing.dom || 0,
        distance: listing.distance || 0,
        imageUrl: listingPhotos[0] || undefined,
        photos: listingPhotos,
        mlsNumber: listing.mlsNumber || "",
        status: listing.standardStatus || listing.status || "",
        lastStatus: listing.lastStatus || "",
        listDate: listing.listDate || "",
        map: (listingLat && listingLng) ? {
          latitude: parseFloat(listingLat),
          longitude: parseFloat(listingLng),
        } : undefined,
        lot: lotData,
        lotSizeAcres: lotData.acres,
        lotSizeSquareFeet: lotData.squareFeet,
        pricePerAcre: calculatePricePerAcre(effectivePrice, lotData.acres),
        type: 'Sale',
      };
    });
  } catch (error: any) {
    console.warn("[Repliers] Failed to fetch similar listings:", error.message || error);
    return [];
  }
}

// Fetch listing details for a single MLS listing (used for backfilling CMA data)
// Returns coordinates AND status data when available
// Tries with boardId first, then without if 404 occurs
export interface ListingEnrichment {
  latitude: number;
  longitude: number;
  status?: string;
  soldPrice?: number;
  soldDate?: string;
}

export async function fetchListingCoordinates(mlsNumber: string): Promise<ListingEnrichment | null> {
  try {
    const formattedMLS = mlsNumber.startsWith("ACT") ? mlsNumber : `ACT${mlsNumber}`;
    
    let data: any;
    try {
      // Try with boardId first
      data = await repliersRequest(`/listings/${formattedMLS}`, { boardId: "53" });
    } catch (firstError: any) {
      // If 404, retry without boardId (listing might be on a different board)
      if (firstError?.message?.includes("404")) {
        console.log(`[CMA] Retrying ${mlsNumber} without boardId...`);
        data = await repliersRequest(`/listings/${formattedMLS}`, {});
      } else {
        throw firstError;
      }
    }
    
    const lat = data?.map?.latitude || data?.address?.latitude || data?.latitude;
    const lng = data?.map?.longitude || data?.address?.longitude || data?.longitude;
    
    if (lat && lng) {
      // Extract status information while we have the listing data
      const status = data?.standardStatus || data?.status || data?.lastStatus || '';
      const soldPrice = data?.soldPrice || data?.closePrice;
      const soldDate = data?.soldDate || data?.closedDate || data?.timestamps?.closedDate;
      
      return {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        status: status,
        soldPrice: soldPrice ? parseFloat(soldPrice) : undefined,
        soldDate: soldDate || undefined,
      };
    }
    console.log(`[CMA] No coordinates found for ${mlsNumber}`);
    return null;
  } catch (error) {
    console.error(`[CMA] Error fetching coordinates for ${mlsNumber}:`, error);
    return null;
  }
}

// Enrich CMA comparables with coordinates and status by fetching from Repliers API
export async function enrichCMAWithCoordinates(comparables: CMAComparable[]): Promise<CMAComparable[]> {
  // Determine which comparables need enrichment (missing coordinates OR status)
  const needsEnrichment = comparables.filter(c => {
    const hasCoords = c.map && c.map.latitude && c.map.longitude;
    const hasStatus = c.status && c.status.trim().length > 0;
    return c.mlsNumber && (!hasCoords || !hasStatus);
  });
  const noMls = comparables.filter(c => !c.mlsNumber).length;
  
  if (needsEnrichment.length === 0) {
    if (noMls > 0) {
      console.log(`[CMA] ${noMls} comparables lack MLS numbers and cannot be enriched`);
    }
    return comparables;
  }
  
  console.log(`[CMA] Enriching ${needsEnrichment.length} comparables with coordinates/status (${noMls} lack MLS numbers)`);
  
  // Fetch listing data for all entries needing enrichment in parallel (with limit)
  const pLimit = (await import('p-limit')).default;
  const limit = pLimit(3); // Max 3 concurrent requests
  
  const enrichmentResults = await Promise.all(
    needsEnrichment.map(comp => 
      limit(async () => {
        const mlsNum = comp.mlsNumber || '';
        const enrichment = await fetchListingCoordinates(mlsNum);
        return { mlsNumber: mlsNum, enrichment };
      })
    )
  );
  
  // Build a map of MLS number to enrichment data
  const enrichmentMap = new Map<string, ListingEnrichment>();
  let successCount = 0;
  for (const result of enrichmentResults) {
    if (result.enrichment && result.mlsNumber) {
      enrichmentMap.set(result.mlsNumber, result.enrichment);
      successCount++;
    }
  }
  
  console.log(`[CMA] Enriched ${successCount}/${needsEnrichment.length} comparables with coordinates/status`);
  
  // Merge enrichment data back into comparables
  return comparables.map(comp => {
    const enrichment = enrichmentMap.get(comp.mlsNumber || '');
    if (!enrichment) return comp;
    
    const enrichedComp = { ...comp };
    
    // Merge coordinates if missing
    if (!comp.map || !comp.map.latitude) {
      enrichedComp.map = {
        latitude: enrichment.latitude,
        longitude: enrichment.longitude,
      };
    }
    
    // Merge status if missing or empty
    if (!comp.status || comp.status.trim().length === 0) {
      if (enrichment.status) {
        enrichedComp.status = enrichment.status;
      }
      // Also add soldPrice/soldDate if available (helps with status inference)
      if (enrichment.soldPrice) {
        (enrichedComp as any).soldPrice = enrichment.soldPrice;
      }
      if (enrichment.soldDate) {
        (enrichedComp as any).soldDate = enrichment.soldDate;
      }
    }
    
    return enrichedComp;
  });
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

export interface CMASearchFilters {
  radius: number; // miles
  minPrice?: number;
  maxPrice?: number;
  minSqft?: number;
  maxSqft?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  minBeds?: number;  // Minimum bedrooms (CMA searches use "at least X beds")
  minBaths?: number; // Minimum bathrooms (CMA searches use "at least X baths")
  statuses: string[]; // e.g., ['Active', 'Closed', 'Pending']
  soldWithinMonths?: number;
  maxResults: number;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Generate a circular polygon around a point for GeoJSON map queries
function generateCircularPolygon(lat: number, lng: number, radiusMiles: number, numPoints: number = 16): number[][] {
  const radiusKm = radiusMiles * 1.60934;
  const radiusDegrees = radiusKm / 111.32; // Approximate km per degree at equator
  const latRadians = lat * Math.PI / 180;
  
  const coords: number[][] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i * 2 * Math.PI) / numPoints;
    // Correct formula: lat offset = sin(angle), lng offset = cos(angle) adjusted for latitude
    const latOffset = radiusDegrees * Math.sin(angle);
    const lngOffset = radiusDegrees * Math.cos(angle) / Math.cos(latRadians);
    coords.push([lng + lngOffset, lat + latOffset]); // GeoJSON uses [lng, lat] order
  }
  
  // Close the polygon by appending the first point
  coords.push([...coords[0]]);
  return coords;
}

export async function searchNearbyComparables(
  subjectLat: number,
  subjectLng: number,
  subjectMlsNumber: string,
  filters: CMASearchFilters
): Promise<CMAComparable[]> {
  try {
    const apiKey = process.env.REPLIERS_API_KEY;
    if (!apiKey) {
      throw new Error("REPLIERS_API_KEY not configured");
    }
    
    // Generate polygon for map search
    const mapPolygon = [generateCircularPolygon(subjectLat, subjectLng, filters.radius)];

    // Build base query params (common to all requests) - no map params since they go in POST body
    const buildBaseParams = (): Record<string, string> => {
      const params: Record<string, string> = {
        type: "Sale",
        resultsPerPage: filters.maxResults.toString(),
      };

      // Price filters
      if (filters.minPrice) params.minPrice = filters.minPrice.toString();
      if (filters.maxPrice) params.maxPrice = filters.maxPrice.toString();

      // Size filters
      if (filters.minSqft) params.minSqft = filters.minSqft.toString();
      if (filters.maxSqft) params.maxSqft = filters.maxSqft.toString();

      // Year built filters
      if (filters.minYearBuilt) params.minYearBuilt = filters.minYearBuilt.toString();
      if (filters.maxYearBuilt) params.maxYearBuilt = filters.maxYearBuilt.toString();

      // Beds/baths filters
      if (filters.minBeds) params.minBedrooms = filters.minBeds.toString();
      if (filters.minBaths) params.minBathrooms = filters.minBaths.toString();

      return params;
    };

    const allListings: any[] = [];

    // Determine which queries to run based on requested statuses
    const statuses = filters.statuses || ['Active', 'Closed', 'Active Under Contract', 'Pending'];
    const wantActive = statuses.includes('Active');
    const wantUnderContract = statuses.includes('Active Under Contract') || statuses.includes('Pending');
    const wantClosed = statuses.includes('Closed');

    // Query 1: Active listings (status=A and/or U) - using POST with GeoJSON polygon
    if (wantActive || wantUnderContract) {
      const activeParams = buildBaseParams();
      
      console.log("[CMA Refresh] Searching active listings with POST and polygon, params:", activeParams);

      const activeUrl = new URL(`${REPLIERS_API_BASE}/listings`);
      Object.entries(activeParams).forEach(([key, value]) => {
        activeUrl.searchParams.append(key, value);
      });
      
      // Add status params separately for proper API format
      if (wantActive) activeUrl.searchParams.append('status', 'A');
      if (wantUnderContract) activeUrl.searchParams.append('status', 'U');

      try {
        const activeResponse = await fetch(activeUrl.toString(), {
          method: "POST",
          headers: {
            "REPLIERS-API-KEY": apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ map: mapPolygon }),
        });

        if (activeResponse.ok) {
          const activeData = await activeResponse.json();
          if (activeData.listings && Array.isArray(activeData.listings)) {
            console.log(`[CMA Refresh] Found ${activeData.listings.length} active listings`);
            allListings.push(...activeData.listings);
          }
        } else {
          const errorText = await activeResponse.text();
          console.warn("[CMA Refresh] Active listings query failed:", activeResponse.status, errorText);
        }
      } catch (err) {
        console.warn("[CMA Refresh] Active listings query error:", err);
      }
    }

    // Query 2: Closed/Sold listings (status=U with lastStatus=Sld) - using POST with GeoJSON polygon
    if (wantClosed) {
      const closedParams = buildBaseParams();
      
      // Add sold date filter
      if (filters.soldWithinMonths) {
        const closeDateMin = new Date();
        closeDateMin.setMonth(closeDateMin.getMonth() - filters.soldWithinMonths);
        closedParams.soldDateFrom = closeDateMin.toISOString().split('T')[0];
      }

      console.log("[CMA Refresh] Searching closed listings with POST and polygon, params:", closedParams);

      const closedUrl = new URL(`${REPLIERS_API_BASE}/listings`);
      Object.entries(closedParams).forEach(([key, value]) => {
        closedUrl.searchParams.append(key, value);
      });
      
      // Add status=U and lastStatus=Sld for sold/closed listings
      closedUrl.searchParams.append('status', 'U');
      closedUrl.searchParams.append('lastStatus', 'Sld');

      try {
        const closedResponse = await fetch(closedUrl.toString(), {
          method: "POST",
          headers: {
            "REPLIERS-API-KEY": apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ map: mapPolygon }),
        });

        if (closedResponse.ok) {
          const closedData = await closedResponse.json();
          if (closedData.listings && Array.isArray(closedData.listings)) {
            console.log(`[CMA Refresh] Found ${closedData.listings.length} closed listings`);
            allListings.push(...closedData.listings);
          }
        } else {
          const errorText = await closedResponse.text();
          console.warn("[CMA Refresh] Closed listings query failed:", closedResponse.status, errorText);
        }
      } catch (err) {
        console.warn("[CMA Refresh] Closed listings query error:", err);
      }
    }

    const data = { listings: allListings };

    if (!data.listings || !Array.isArray(data.listings)) {
      console.log("[CMA Refresh] No listings found");
      return [];
    }

    // Filter out rentals and the subject property
    const filteredListings = data.listings.filter((listing: any) => {
      if (isRentalOrLease(listing)) return false;
      if (listing.mlsNumber === subjectMlsNumber) return false;
      return true;
    });

    console.log(`[CMA Refresh] Found ${filteredListings.length} comparables (excluded subject & rentals)`);

    // Map to CMAComparable format (matching existing interface)
    const comparables: CMAComparable[] = filteredListings.map((listing: any) => {
      const listingLat = listing.map?.latitude || listing.address?.latitude;
      const listingLng = listing.map?.longitude || listing.address?.longitude;
      
      let distance = 0;
      if (listingLat && listingLng) {
        distance = calculateDistance(subjectLat, subjectLng, parseFloat(listingLat), parseFloat(listingLng));
      }

      const photos = normalizeImageUrls(listing.images || listing.media || listing.photos);
      const sqft = listing.details?.sqft || listing.sqft || 0;
      const dom = listing.daysOnMarket ? parseInt(listing.daysOnMarket) : 0;

      // Build address from component parts if full/streetAddress not available
      const addressParts: string[] = [];
      if (listing.address?.streetNumber) addressParts.push(listing.address.streetNumber);
      if (listing.address?.streetName) addressParts.push(listing.address.streetName);
      if (listing.address?.streetSuffix) addressParts.push(listing.address.streetSuffix);
      const builtAddress = addressParts.join(' ');
      const fullAddress = listing.address?.full || listing.address?.streetAddress || builtAddress;
      // Add city/state if we have them
      const city = listing.address?.city;
      const state = listing.address?.state;
      const displayAddress = fullAddress && city && state 
        ? `${fullAddress}, ${city}, ${state}`
        : fullAddress || '';

      const lotData = buildLotSizeData(listing);
      const price = parseFloat(listing.listPrice) || 0;
      const soldPrice = listing.soldPrice ? parseFloat(listing.soldPrice) : null;
      const effectivePrice = soldPrice || price;
      
      return {
        mlsNumber: listing.mlsNumber,
        address: displayAddress,
        price: price,
        listPrice: price,
        soldPrice: soldPrice,
        bedrooms: parseInt(listing.details?.numBedrooms || listing.numBedrooms || '0'),
        bathrooms: parseInt(listing.details?.numBathrooms || listing.numBathrooms || '0'),
        sqft: typeof sqft === 'string' ? parseInt(sqft) || 0 : sqft,
        daysOnMarket: dom,
        distance,
        // Include lastStatus for sold listings (lastStatus=Sld indicates sold)
        status: listing.standardStatus || listing.status || '',
        lastStatus: listing.lastStatus || '',
        listDate: listing.listDate || listing.timestamps?.listDate || undefined,
        photos: photos.slice(0, 10),
        imageUrl: photos[0],
        map: (listingLat && listingLng) ? {
          latitude: parseFloat(listingLat),
          longitude: parseFloat(listingLng),
        } : undefined,
        lot: lotData,
        lotSizeAcres: lotData.acres,
        lotSizeSquareFeet: lotData.squareFeet,
        pricePerAcre: calculatePricePerAcre(effectivePrice, lotData.acres),
        type: 'Sale',
      };
    });

    // Sort by distance (closest first)
    comparables.sort((a, b) => (a.distance || 999) - (b.distance || 999));

    return comparables.slice(0, filters.maxResults);
  } catch (error) {
    console.error("[CMA Refresh] Error searching nearby comparables:", error);
    throw error;
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
