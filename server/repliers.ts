// Real Repliers MLS API integration using REPLIERS_API_KEY

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

  console.log("Repliers API request:", url.toString());

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "REPLIERS-API-KEY": apiKey,
      "Accept": "application/json",
    },
  });

  const responseText = await response.text();
  console.log("Repliers API response status:", response.status, response.statusText);
  console.log("Repliers API response body (first 2000 chars):", responseText.substring(0, 2000));

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
  daysOnMarket: number;
  listDate: string;
  
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

  console.log("Testing Repliers API - searching by address...");
  
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
  console.log("Repliers address search response status:", response.status);
  console.log("Repliers address search full response:", responseText);

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
  
  console.log("Searching by MLS number using POST:", mlsNumber);
  
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
    console.log("POST search failed:", response.status);
    return null;
  }
  
  const data = await response.json();
  console.log("POST search result:", data.count, "listings found");
  return data.listings?.[0] || null;
}

export async function fetchMLSListing(mlsNumber: string, boardId?: string): Promise<{ mlsData: MLSListingData; comparables: CMAComparable[] } | null> {
  try {
    // Add ACT prefix for Unlock MLS (Austin) if not already present
    const formattedMLS = mlsNumber.startsWith("ACT") ? mlsNumber : `ACT${mlsNumber}`;
    
    console.log("Fetching MLS listing:", mlsNumber, "-> formatted:", formattedMLS);
    
    // Use direct listing endpoint: GET /listings/{mlsNumber}
    // Always include boardId=53 for Unlock MLS
    const params: Record<string, string> = {
      boardId: boardId || "53",
    };
    
    let data: any = null;
    try {
      data = await repliersRequest(`/listings/${formattedMLS}`, params);
      console.log("Repliers API full response for MLS", formattedMLS, ":", JSON.stringify(data, null, 2));
      
      // Debug: Log image-related fields at top level
      console.log("Repliers top-level image fields:", JSON.stringify({
        media: data.media,
        images: data.images,
        photos: data.photos,
        Pictures: data.Pictures,
        Photo: data.Photo,
        MediaURL: data.MediaURL,
        allKeys: Object.keys(data)
      }, null, 2));
    } catch (directError: any) {
      console.log("Direct lookup failed:", directError.message);
      console.log("Trying POST search as fallback...");
      
      // Try searching by MLS number using POST
      data = await searchByMLSNumber(mlsNumber);
      if (!data) {
        // Try with ACT prefix
        data = await searchByMLSNumber(formattedMLS);
      }
      if (data) {
        console.log("Found listing via POST search");
      }
    }
    
    if (!data) {
      console.log("No listing data found for MLS:", mlsNumber);
      return null;
    }
    
    let listing = data;
    if (data.listings && Array.isArray(data.listings)) {
      if (data.listings.length === 0) {
        console.log("No listings found for MLS number:", mlsNumber);
        return null;
      }
      listing = data.listings[0];
    }
    
    if (!listing) return null;

    console.log("Processing listing object keys:", Object.keys(listing));
    console.log("Listing details:", listing.details ? Object.keys(listing.details) : "no details");
    
    // Debug: Log all image-related fields in the listing object
    console.log("Listing image fields:", JSON.stringify({
      media: listing.media ? `Array(${listing.media.length})` : listing.media,
      images: listing.images ? `Array(${listing.images.length})` : listing.images,
      photos: listing.photos ? `Array(${listing.photos.length})` : listing.photos,
      Pictures: listing.Pictures,
      Photo: listing.Photo,
      MediaURL: listing.MediaURL,
      detailsPhotos: listing.details?.photos,
      detailsImages: listing.details?.images,
      sampleMedia: listing.media?.[0] ? JSON.stringify(listing.media[0]).substring(0, 200) : null
    }, null, 2));

    const rawImages = listing.media || listing.images || listing.photos || [];
    console.log("Raw images selected:", rawImages?.length || 0, "items");
    if (rawImages.length > 0) {
      console.log("First raw image sample:", JSON.stringify(rawImages[0]).substring(0, 300));
    }
    
    const photos = normalizeImageUrls(rawImages);
    console.log("After normalizeImageUrls:", photos.length, "valid URLs");
    if (photos.length > 0) {
      console.log("Sample normalized URLs:", photos.slice(0, 3));
    }
    
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
      daysOnMarket: listing.daysOnMarket || listing.dom || 0,
      listDate: listing.listDate || listing.listingDate || "",
      
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
    };

    // Extract comparables from the listing response if available
    let comparables: CMAComparable[] = [];
    if (listing.comparables && Array.isArray(listing.comparables)) {
      console.log(`Found ${listing.comparables.length} comparables in listing data`);
      comparables = listing.comparables.slice(0, 10).map((comp: any) => {
        const compAddressParts = [];
        if (comp.address?.streetNumber) compAddressParts.push(comp.address.streetNumber);
        if (comp.address?.streetName) compAddressParts.push(comp.address.streetName);
        if (comp.address?.streetSuffix) compAddressParts.push(comp.address.streetSuffix);
        const compStreetAddress = compAddressParts.join(" ");
        
        return {
          address: comp.address?.full || compStreetAddress || "",
          price: parseFloat(comp.listPrice) || parseFloat(comp.soldPrice) || 0,
          bedrooms: comp.bedroomsTotal || comp.details?.numBedrooms || comp.beds || 0,
          bathrooms: comp.bathroomsFull || comp.details?.numBathrooms || comp.baths || 0,
          sqft: comp.livingArea || comp.buildingAreaTotal || comp.details?.sqft || comp.sqft || 0,
          daysOnMarket: comp.daysOnMarket || comp.simpleDaysOnMarket || comp.dom || 0,
          distance: comp.distance || 0,
          imageUrl: normalizeImageUrls(comp.images)?.[0] || undefined,
          mlsNumber: comp.mlsNumber || "",
          status: comp.standardStatus || comp.status || "",
          listDate: comp.listDate || "",
        };
      });
    }

    console.log("Parsed MLS data:", {
      mlsNumber: result.mlsNumber,
      price: result.listPrice,
      beds: result.bedrooms,
      baths: result.bathrooms,
      sqft: result.sqft,
      photos: result.photos.length,
      comparables: comparables.length,
      features: {
        interior: result.interiorFeatures.length,
        exterior: result.exteriorFeatures.length,
        appliances: result.appliances.length,
      }
    });

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
    
    console.log(`Fetching similar listings for MLS: ${formattedMlsNumber}`);
    
    const data = await repliersRequest("/listings/similar", {
      mlsNumber: formattedMlsNumber,
      radius: radius.toString(),
      boardId: "53", // Unlock MLS board ID
    });

    console.log("Repliers similar listings response:", JSON.stringify(data).substring(0, 300));

    if (!data.listings || !Array.isArray(data.listings)) {
      return [];
    }

    return data.listings.slice(0, 10).map((listing: any) => {
      const addressParts = [];
      if (listing.address?.streetNumber) addressParts.push(listing.address.streetNumber);
      if (listing.address?.streetName) addressParts.push(listing.address.streetName);
      const streetAddress = addressParts.join(" ");
      
      return {
        address: listing.address?.full || streetAddress || "",
        price: parseFloat(listing.listPrice) || parseFloat(listing.soldPrice) || 0,
        bedrooms: listing.bedroomsTotal || listing.details?.numBedrooms || listing.beds || 0,
        bathrooms: listing.bathroomsFull || listing.details?.numBathrooms || listing.baths || 0,
        sqft: listing.livingArea || listing.details?.sqft || listing.sqft || 0,
        daysOnMarket: listing.daysOnMarket || listing.dom || 0,
        distance: listing.distance || 0,
        imageUrl: normalizeImageUrls(listing.media || listing.images)?.[0] || undefined,
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
    });

    if (!data.listings || !Array.isArray(data.listings) || data.listings.length === 0) {
      return null;
    }

    const listing = data.listings[0];
    const result = await fetchMLSListing(listing.mlsNumber);
    return result?.mlsData || null;
  } catch (error) {
    console.error("Error searching by address:", error);
    return null;
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

    const data = await repliersRequest("/listings", queryParams);

    if (!data.listings || !Array.isArray(data.listings)) {
      return [];
    }

    const results: MLSListingData[] = [];
    for (const listing of data.listings.slice(0, 20)) {
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
