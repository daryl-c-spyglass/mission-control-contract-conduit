export async function imageUrlToBase64(url: string): Promise<string | null> {
  if (!url) return null;
  
  if (url.startsWith('data:')) {
    return url;
  }
  
  try {
    // Use server-side proxy to avoid CORS issues with external CDN images
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      console.warn(`[imageToBase64] Failed to fetch image via proxy: ${url} (${response.status})`);
      return null;
    }
    
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        console.warn(`[imageToBase64] Failed to read blob for: ${url}`);
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(`[imageToBase64] Error converting image: ${url}`, error);
    return null;
  }
}

export async function convertPhotosToBase64(photos: string[]): Promise<string[]> {
  console.log(`[imageToBase64] Converting ${photos.length} photos to base64...`);
  
  const results = await Promise.all(
    photos.map(async (url, index) => {
      const base64 = await imageUrlToBase64(url);
      if (base64) {
        console.log(`[imageToBase64] Converted photo ${index + 1}/${photos.length}`);
      }
      return base64;
    })
  );
  
  const converted = results.filter((url): url is string => url !== null);
  console.log(`[imageToBase64] Successfully converted ${converted.length}/${photos.length} photos`);
  
  return converted;
}

export async function processComparablesForPdf<T extends { photos?: string[]; primaryPhoto?: string }>(
  comparables: T[]
): Promise<(T & { base64Photos?: string[]; base64PrimaryPhoto?: string })[]> {
  console.log(`[imageToBase64] Processing ${comparables.length} comparables for PDF...`);
  
  const processed = await Promise.all(
    comparables.map(async (comp, index) => {
      const photos = comp.photos || [];
      const primaryPhoto = comp.primaryPhoto || photos[0];
      
      let base64PrimaryPhoto: string | undefined;
      if (primaryPhoto) {
        const base64 = await imageUrlToBase64(primaryPhoto);
        if (base64) {
          base64PrimaryPhoto = base64;
        }
      }
      
      console.log(`[imageToBase64] Processed comparable ${index + 1}/${comparables.length} - photo: ${base64PrimaryPhoto ? 'success' : 'failed'}`);
      
      return {
        ...comp,
        base64PrimaryPhoto,
      };
    })
  );
  
  return processed;
}
