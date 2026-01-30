import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface AgentProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  company: string;
  profilePhoto: string | null;
  bio: string;
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
    profileImageUrl?: string;
    marketingPhone?: string;
    marketingEmail?: string;
    marketingDisplayName?: string;
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
      
      // Use marketingDisplayName if available, otherwise fall back to firstName + lastName
      const displayName = user?.marketingDisplayName?.trim();
      const fallbackName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
      const fullName = displayName || fallbackName;
      
      // Split for firstName/lastName if only displayName is available
      const nameParts = fullName.split(' ');
      const firstName = displayName ? nameParts[0] || '' : (user?.firstName || '');
      const lastName = displayName ? nameParts.slice(1).join(' ') || '' : (user?.lastName || '');
      
      return {
        firstName,
        lastName,
        email: user?.marketingEmail || user?.email || "",
        phone: user?.marketingPhone || "",
        title: user?.marketingTitle || profile?.title || "REALTOR®",
        company: profile?.marketingCompany || "Spyglass Realty",
        profilePhoto: user?.marketingHeadshotUrl || profile?.headshotUrl || user?.profileImageUrl || null,
        bio: profile?.bio || "",
      };
    },
    staleTime: 0,               // Always consider stale - refetch on mount
    refetchOnMount: true,       // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
}

// Helper to invalidate agent data caches (call after saving in Settings)
export function useInvalidateAgentData() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ["/api/agent/profile"] });
    queryClient.invalidateQueries({ queryKey: ["/api/settings/marketing-profile"] });
  };
}
