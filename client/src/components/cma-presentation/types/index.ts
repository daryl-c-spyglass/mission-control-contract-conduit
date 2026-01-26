export interface WidgetDefinition {
  id: string;
  number: number;
  title: string;
  subtitle?: string;
  icon: 'user' | 'spyglass' | 'quote' | 'homes' | 'clock' | 'dollar' | 'chart' | 'megaphone' | 'clipboard' | 'link';
  type: 'dynamic' | 'static' | 'youtube' | 'text';
  imagePath?: string;
  component?: string;
  badge?: number | string;
  videoUrl?: string;
}

export interface AgentProfile {
  name: string;
  company: string;
  photo?: string;
  phone?: string;
  email?: string;
  bio?: string;
}

export interface CmaProperty {
  id: string;
  mlsNumber?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  soldPrice?: number;
  originalPrice?: number;
  sqft: number;
  beds: number;
  baths: number;
  lotSize?: number;
  yearBuilt?: number;
  garageSpaces?: number;
  status: 'Active' | 'Pending' | 'Closed' | 'Active Under Contract';
  daysOnMarket: number;
  listDate?: string;
  soldDate?: string;
  lastUpdated?: string;
  pricePerSqft: number;
  photos: string[];
  isSubject?: boolean;
  latitude?: number;
  longitude?: number;
  acres?: number;
  description?: string;
}

export interface CmaPresentationData {
  propertyAddress: string;
  mlsNumber: string;
  preparedFor?: string;
  agent: AgentProfile;
  subjectProperty?: CmaProperty;
  comparables: CmaProperty[];
  averageDaysOnMarket: number;
  averagePricePerSqft: number;
  suggestedListPrice?: number;
  averagePricePerAcre?: number;
}
