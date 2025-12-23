// Real Follow Up Boss API integration using FUB_API_KEY

const FUB_API_BASE = "https://api.followupboss.com/v1";

async function fubRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
  const apiKey = process.env.FUB_API_KEY;
  if (!apiKey) {
    throw new Error("FUB_API_KEY not configured");
  }

  const url = new URL(`${FUB_API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Authorization": `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`FUB API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export interface FUBContact {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  stage: string;
  created: string;
}

export async function searchFUBContacts(query: string): Promise<FUBContact[]> {
  try {
    const data = await fubRequest("/people", {
      name: query,
      limit: "20",
    });

    if (!data.people || !Array.isArray(data.people)) {
      return [];
    }

    return data.people.map((person: any) => ({
      id: person.id,
      firstName: person.firstName || "",
      lastName: person.lastName || "",
      email: person.emails?.[0]?.value || person.email || null,
      phone: person.phones?.[0]?.value || null,
      tags: person.tags || [],
      stage: person.stage || "",
      created: person.created || "",
    }));
  } catch (error) {
    console.error("Error searching FUB contacts:", error);
    return [];
  }
}

export async function getFUBContact(id: number): Promise<FUBContact | null> {
  try {
    const data = await fubRequest(`/people/${id}`);

    if (!data) return null;

    return {
      id: data.id,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      email: data.emails?.[0]?.value || data.email || null,
      phone: data.phones?.[0]?.value || null,
      tags: data.tags || [],
      stage: data.stage || "",
      created: data.created || "",
    };
  } catch (error) {
    console.error("Error fetching FUB contact:", error);
    return null;
  }
}

export interface FUBUser {
  id: number;
  email: string;
  name: string;
}

export async function getFUBUserByEmail(email: string): Promise<FUBUser | null> {
  try {
    const data = await fubRequest("/users");
    
    if (!data.users || !Array.isArray(data.users)) {
      return null;
    }
    
    const user = data.users.find((u: any) => 
      u.email?.toLowerCase() === email.toLowerCase()
    );
    
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    };
  } catch (error) {
    console.error("Error fetching FUB user by email:", error);
    return null;
  }
}

export async function searchFUBContactsByAssignedUser(query: string, fubUserId?: string): Promise<FUBContact[]> {
  try {
    const params: Record<string, string> = {
      name: query,
      limit: "20",
    };
    
    if (fubUserId) {
      params.assignedUserId = fubUserId;
    }
    
    const data = await fubRequest("/people", params);

    if (!data.people || !Array.isArray(data.people)) {
      return [];
    }

    return data.people.map((person: any) => ({
      id: person.id,
      firstName: person.firstName || "",
      lastName: person.lastName || "",
      email: person.emails?.[0]?.value || person.email || null,
      phone: person.phones?.[0]?.value || null,
      tags: person.tags || [],
      stage: person.stage || "",
      created: person.created || "",
    }));
  } catch (error) {
    console.error("Error searching FUB contacts by assigned user:", error);
    return [];
  }
}

export async function searchFUBContactsByEmail(email: string): Promise<FUBContact[]> {
  try {
    const data = await fubRequest("/people", {
      email: email,
      limit: "10",
    });

    if (!data.people || !Array.isArray(data.people)) {
      return [];
    }

    return data.people.map((person: any) => ({
      id: person.id,
      firstName: person.firstName || "",
      lastName: person.lastName || "",
      email: person.emails?.[0]?.value || person.email || null,
      phone: person.phones?.[0]?.value || null,
      tags: person.tags || [],
      stage: person.stage || "",
      created: person.created || "",
    }));
  } catch (error) {
    console.error("Error searching FUB contacts by email:", error);
    return [];
  }
}
