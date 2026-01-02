// Real Repliers MLS API integration using REPLIERS_API_KEY

const REPLIERS_API_BASE = "https://api.repliers.io";

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
  sqft: number;
  daysOnMarket: number;
  distance: number;
  imageUrl?: string;
}

function normalizeImageUrls(images: any): string[] {
  if (!images) return [];
  if (!Array.isArray(images)) return [];
  
  return images
    .map((img: any) => {
      if (typeof img === "string") return img;
      if (typeof img === "object" && img !== null) {
        return img.mediaUrl || img.url || img.src || img.href || img.imageUrl || "";
      }
      return "";
    })
    .filter((url: string) => url && typeof url === "string" && url.startsWith("http"));
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

// Test function to check Repliers API access and discover available boards
export async function testRepliersAccess(): Promise<any> {
  const apiKey = process.env.REPLIERS_API_KEY;
  if (!apiKey) {
    throw new Error("REPLIERS_API_KEY not configured");
  }

  console.log("Testing Repliers API access with POST search...");
  
  const response = await fetch("https://api.repliers.io/listings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "REPLIERS-API-KEY": apiKey,
    },
    body: JSON.stringify({
      city: "Austin",
      state: "TX",
      class: "residential",
      status: "A",
      pageSize: 5,
    }),
  });

  const responseText = await response.text();
  console.log("Repliers test response status:", response.status);
  console.log("Repliers test response FULL:", responseText);

  if (!response.ok) {
    return { error: `API error: ${response.status}`, body: responseText };
  }

  try {
    const data = JSON.parse(responseText);
    // Extract useful info about first listing
    if (data.listings && data.listings.length > 0) {
      console.log("First listing boardId:", data.listings[0].boardId);
      console.log("First listing mlsNumber:", data.listings[0].mlsNumber);
      console.log("First listing keys:", Object.keys(data.listings[0]));
    }
    return data;
  } catch (e) {
    return { error: "Failed to parse JSON", body: responseText };
  }
}

export async function fetchMLSListing(mlsNumber: string, boardId?: string): Promise<MLSListingData | null> {
  try {
    // Use direct listing endpoint: GET /listings/{mlsNumber}
    // Include boardId if provided (required for some MLS systems)
    const params: Record<string, string> = {};
    if (boardId) {
      params.boardId = boardId;
    }
    const data = await repliersRequest(`/listings/${mlsNumber}`, Object.keys(params).length > 0 ? params : undefined);
    
    console.log("Repliers API full response for MLS", mlsNumber, ":", JSON.stringify(data, null, 2));
    
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
      daysOnMarket: listing.daysOnMarket || listing.dom || 0,
      listDate: listing.listDate || listing.listingDate || "",
      
      description: listing.publicRemarks || listing.privateRemarks || listing.remarks || listing.details?.description || "",
      
      interiorFeatures: parseFeatures(listing.interiorFeatures || listing.details?.interiorFeatures),
      exteriorFeatures: parseFeatures(listing.exteriorFeatures || listing.details?.exteriorFeatures),
      appliances: parseFeatures(listing.appliances || listing.details?.appliances),
      heatingCooling: Array.from(new Set(heatingCooling)),
      
      hoaFee: listing.associationFee || listing.hoaFee || null,
      hoaFrequency: listing.associationFeeFrequency || listing.hoaFrequency || "Monthly",
      taxAmount: listing.taxAnnualAmount || listing.taxes || null,
      taxYear: listing.taxYear || null,
      
      listingAgent: listing.listAgentFullName || listing.agents?.[0]?.name || "",
      listingOffice: listing.listOfficeName || listing.office?.name || listing.agents?.[0]?.brokerage || "",
      listingAgentPhone: listing.listAgentPhone || listing.agents?.[0]?.phone || "",
      listingAgentEmail: listing.listAgentEmail || listing.agents?.[0]?.email || "",
      
      photos: photos,
      images: photos,
      agent: listing.agents?.[0] ? {
        name: listing.agents[0].name || "",
        phone: listing.agents[0].phone || "",
        email: listing.agents[0].email || "",
        brokerage: listing.agents[0].brokerage || listing.office?.name || "",
      } : {
        name: listing.listAgentFullName || "",
        phone: listing.listAgentPhone || "",
        email: listing.listAgentEmail || "",
        brokerage: listing.listOfficeName || "",
      },
    };

    console.log("Parsed MLS data:", {
      mlsNumber: result.mlsNumber,
      price: result.listPrice,
      beds: result.bedrooms,
      baths: result.bathrooms,
      sqft: result.sqft,
      photos: result.photos.length,
      features: {
        interior: result.interiorFeatures.length,
        exterior: result.exteriorFeatures.length,
        appliances: result.appliances.length,
      }
    });

    return result;
  } catch (error) {
    console.error("Error fetching MLS listing:", error);
    return null;
  }
}

export async function fetchSimilarListings(mlsNumber: string, radius: number = 5): Promise<CMAComparable[]> {
  try {
    const data = await repliersRequest("/listings/similar", {
      mlsNumber,
      radius: radius.toString(),
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
    return fetchMLSListing(listing.mlsNumber);
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
      const fullListing = await fetchMLSListing(listing.mlsNumber);
      if (fullListing) {
        results.push(fullListing);
      }
    }
    return results;
  } catch (error) {
    console.error("Error searching listings:", error);
    return [];
  }
}
