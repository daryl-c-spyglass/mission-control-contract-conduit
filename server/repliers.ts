// Real Repliers MLS API integration using REPLIERS_API_KEY

const REPLIERS_API_BASE = "https://api.repliers.io";

async function repliersRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
  const apiKey = process.env.REPLIERS_API_KEY;
  if (!apiKey) {
    throw new Error("REPLIERS_API_KEY not configured");
  }

  const url = new URL(`${REPLIERS_API_BASE}${endpoint}`);
  
  // Add API key as query parameter (Repliers accepts both header and query param)
  url.searchParams.append("repliers_api_key", apiKey);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  console.log("Repliers API request:", url.toString().replace(apiKey, "***"));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const responseText = await response.text();
  console.log("Repliers API response status:", response.status, response.statusText);
  console.log("Repliers API response body (first 1000 chars):", responseText.substring(0, 1000));

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
    // Use query parameter for MLS number lookup (as per Repliers API docs)
    const data = await repliersRequest("/listings", { mlsNumber });
    
    console.log("Repliers API response for MLS", mlsNumber, ":", JSON.stringify(data).substring(0, 500));
    
    // Response could be a single listing or an array of listings
    let listing = data;
    if (data.listings && Array.isArray(data.listings)) {
      if (data.listings.length === 0) {
        console.log("No listings found for MLS number:", mlsNumber);
        return null;
      }
      listing = data.listings[0];
    }
    
    if (!listing) return null;

    const rawImages = listing.images || listing.photos || [];
    
    // Build full address from components
    const addressParts = [];
    if (listing.address?.streetNumber) addressParts.push(listing.address.streetNumber);
    if (listing.address?.streetName) addressParts.push(listing.address.streetName);
    if (listing.address?.streetSuffix) addressParts.push(listing.address.streetSuffix);
    const streetAddress = addressParts.join(" ");
    const fullAddress = listing.address?.full || streetAddress;

    return {
      mlsNumber: listing.mlsNumber || mlsNumber,
      listPrice: parseFloat(listing.listPrice) || 0,
      address: fullAddress,
      city: listing.address?.city || "",
      state: listing.address?.state || listing.address?.province || "",
      bedrooms: listing.details?.numBedrooms || listing.beds || 0,
      bathrooms: listing.details?.numBathrooms || listing.baths || 0,
      sqft: listing.details?.sqft || listing.sqft || 0,
      yearBuilt: listing.details?.yearBuilt || 0,
      propertyType: listing.details?.propertyType || listing.class || "Residential",
      description: listing.details?.description || listing.publicRemarks || listing.remarks || "",
      listDate: listing.listDate || listing.listingDate || "",
      status: listing.status || listing.listingStatus || "",
      images: normalizeImageUrls(rawImages),
      agent: listing.agents?.[0] ? {
        name: listing.agents[0].name || "",
        phone: listing.agents[0].phone || "",
        email: listing.agents[0].email || "",
        brokerage: listing.agents[0].brokerage || listing.office?.name || "",
      } : undefined,
    };
  } catch (error) {
    console.error("Error fetching MLS listing:", error);
    return null;
  }
}

export async function fetchSimilarListings(mlsNumber: string, radius: number = 5): Promise<CMAComparable[]> {
  try {
    // Use the similar listings endpoint
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
        bedrooms: listing.details?.numBedrooms || listing.beds || 0,
        bathrooms: listing.details?.numBathrooms || listing.baths || 0,
        sqft: listing.details?.sqft || listing.sqft || 0,
        daysOnMarket: listing.daysOnMarket || listing.dom || 0,
        distance: listing.distance || 0,
        imageUrl: listing.images?.[0] || listing.photos?.[0]?.url || undefined,
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
