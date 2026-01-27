import { useQuery } from "@tanstack/react-query";

export interface MarketingProfile {
  agentPhoto: string | null;
  agentTitle: string;
  qrCode: string | null;
  companyLogo: string | null;
  companyLogoUseDefault: boolean;
  secondaryLogo: string | null;
  secondaryLogoUseDefault: boolean;
}

export function useMarketingProfile() {
  return useQuery<MarketingProfile>({
    queryKey: ["/api/settings/marketing-profile"],
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}
