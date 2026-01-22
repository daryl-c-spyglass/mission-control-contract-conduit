import { useQuery } from "@tanstack/react-query";

export interface AgentProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  company: string;
  profilePhoto: string | null;
}

interface AgentProfileResponse {
  profile: {
    id?: string;
    userId?: string;
    title?: string;
    headshotUrl?: string;
    bio?: string;
    defaultCoverLetter?: string;
    marketingCompany?: string;
  } | null;
  user: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
    marketingTitle?: string;
    marketingHeadshotUrl?: string;
  } | null;
}

export function useAgentProfile() {
  return useQuery<AgentProfileData>({
    queryKey: ["/api/agent/profile"],
    queryFn: async () => {
      const response = await fetch("/api/agent/profile", {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Failed to fetch agent profile");
      }
      const data: AgentProfileResponse = await response.json();
      
      // Normalize the response into a simple AgentProfileData format
      const user = data.user;
      const profile = data.profile;
      
      return {
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        email: user?.email || "",
        phone: user?.phone || "",
        title: user?.marketingTitle || profile?.title || "REALTOR®",
        company: user?.company || profile?.marketingCompany || "Spyglass Realty",
        profilePhoto: user?.marketingHeadshotUrl || profile?.headshotUrl || null,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
