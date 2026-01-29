export interface ImageTransform {
  scale: number;
  positionX: number;
  positionY: number;
}

export interface ImageTransforms {
  mainImage: ImageTransform;
  kitchenImage: ImageTransform;
  roomImage: ImageTransform;
  agentPhoto: ImageTransform;
}

export interface FlyerImages {
  mainImage: string | null;
  kitchenImage: string | null;
  roomImage: string | null;
  agentPhoto: string | null;
  companyLogo: string | null;
  secondaryLogo: string | null;
  qrCode: string | null;
}

export interface FlyerData {
  price: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  introHeading: string;
  introDescription: string;
  agentName: string;
  agentTitle: string;
  phone: string;
}

export const DEFAULT_TRANSFORM: ImageTransform = {
  scale: 1,
  positionX: 0,
  positionY: 0,
};

export const DEFAULT_TRANSFORMS: ImageTransforms = {
  mainImage: { ...DEFAULT_TRANSFORM },
  kitchenImage: { ...DEFAULT_TRANSFORM },
  roomImage: { ...DEFAULT_TRANSFORM },
  agentPhoto: { ...DEFAULT_TRANSFORM },
};
