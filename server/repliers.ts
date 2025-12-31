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

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Repliers API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export interface MLSListingData {
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

// Helper to normalize image URLs from various API response formats
function normalizeImageUrls(images: any): string[] {
  if (!images) return [];
  if (!Array.isArray(images)) return [];
  
  return images
    .map((img: any) => {
      if (typeof img === "string") return img;
      if (typeof img === "object" && img !== null) {
        return img.url || img.src || img.href || img.imageUrl || "";
      }
      return "";
    })
    .filter((url: string) => url && typeof url === "string" && url.startsWith("http"));
}

export async function fetchMLSListing(mlsNumber: string): Promise<MLSListingData | null> {
  try {
    const data = await repliersRequest(`/listings/${mlsNumber}`);
    
    if (!data) return null;

    const rawImages = data.images || data.photos || [];

    return {
      mlsNumber: data.mlsNumber || mlsNumber,
      listPrice: parseFloat(data.listPrice) || 0,
      address: data.address?.full || data.address?.streetName || "",
      city: data.address?.city || "",
      state: data.address?.state || "",
      bedrooms: data.beds || data.details?.numBedrooms || 0,
      bathrooms: data.baths || data.details?.numBathrooms || 0,
      sqft: data.details?.sqft || data.sqft || 0,
      yearBuilt: data.details?.yearBuilt || 0,
      propertyType: data.details?.propertyType || data.class || "Residential",
      description: data.details?.description || data.publicRemarks || "",
      listDate: data.listingDate || data.listDate || "",
      status: data.status || data.listingStatus || "",
      images: normalizeImageUrls(rawImages),
      agent: data.agent ? {
        name: data.agent.name || "",
        phone: data.agent.phone || "",
        email: data.agent.email || "",
        brokerage: data.agent.brokerage || data.office?.name || "",
      } : undefined,
    };
  } catch (error) {
    console.error("Error fetching MLS listing:", error);
    return null;
  }
}

export async function fetchSimilarListings(mlsNumber: string, radius: number = 5): Promise<CMAComparable[]> {
  try {
    const data = await repliersRequest(`/listings/${mlsNumber}/similar`, {
      radius: radius.toString(),
    });

    if (!data.listings || !Array.isArray(data.listings)) {
      return [];
    }

    return data.listings.slice(0, 10).map((listing: any) => ({
      address: listing.address?.full || listing.address?.streetName || "",
      price: parseFloat(listing.listPrice) || parseFloat(listing.soldPrice) || 0,
      bedrooms: listing.beds || listing.details?.numBedrooms || 0,
      bathrooms: listing.baths || listing.details?.numBathrooms || 0,
      sqft: listing.details?.sqft || listing.sqft || 0,
      daysOnMarket: listing.daysOnMarket || listing.dom || 0,
      distance: listing.distance || 0,
      imageUrl: listing.images?.[0] || listing.photos?.[0]?.url || undefined,
    }));
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

    // Return the first (best match) result
    const listing = data.listings[0];
    const rawImages = listing.images || listing.photos || [];
    
    return {
      mlsNumber: listing.mlsNumber || "",
      listPrice: parseFloat(listing.listPrice) || 0,
      address: listing.address?.full || listing.address?.streetName || "",
      city: listing.address?.city || "",
      state: listing.address?.state || "",
      bedrooms: listing.beds || listing.details?.numBedrooms || 0,
      bathrooms: listing.baths || listing.details?.numBathrooms || 0,
      sqft: listing.details?.sqft || listing.sqft || 0,
      yearBuilt: listing.details?.yearBuilt || 0,
      propertyType: listing.details?.propertyType || listing.class || "Residential",
      description: listing.details?.description || listing.publicRemarks || "",
      listDate: listing.listingDate || listing.listDate || "",
      status: listing.status || listing.listingStatus || "",
      images: normalizeImageUrls(rawImages),
      agent: listing.agent ? {
        name: listing.agent.name || "",
        phone: listing.agent.phone || "",
        email: listing.agent.email || "",
        brokerage: listing.agent.brokerage || listing.office?.name || "",
      } : undefined,
    };
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

    return data.listings.map((listing: any) => ({
      mlsNumber: listing.mlsNumber || "",
      listPrice: parseFloat(listing.listPrice) || 0,
      address: listing.address?.full || listing.address?.streetName || "",
      city: listing.address?.city || "",
      state: listing.address?.state || "",
      bedrooms: listing.beds || listing.details?.numBedrooms || 0,
      bathrooms: listing.baths || listing.details?.numBathrooms || 0,
      sqft: listing.details?.sqft || listing.sqft || 0,
      yearBuilt: listing.details?.yearBuilt || 0,
      propertyType: listing.details?.propertyType || listing.class || "Residential",
      description: listing.details?.description || listing.publicRemarks || "",
      listDate: listing.listingDate || listing.listDate || "",
      images: listing.images || listing.photos?.map((p: any) => p.url) || [],
    }));
  } catch (error) {
    console.error("Error searching listings:", error);
    return [];
  }
}
