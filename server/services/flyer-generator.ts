import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { execSync } from 'child_process';
import crypto from 'crypto';

// 8.5x11 at 300 DPI - moved to top for use in launchBrowser
const FLYER_WIDTH = 2550;
const FLYER_HEIGHT = 3300;

// Detect if we're in production (Render) or development (Replit)
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER;

// Launch browser with appropriate configuration for environment
async function launchBrowser(): Promise<any> {
  if (isProduction) {
    // Use @sparticuz/chromium on Render (bundles its own Chromium)
    console.log('[FlyerGenerator] Using @sparticuz/chromium for production');
    console.log('[FlyerGenerator] NODE_ENV:', process.env.NODE_ENV);
    console.log('[FlyerGenerator] RENDER:', process.env.RENDER);
    
    try {
      const execPath = await chromium.executablePath();
      console.log('[FlyerGenerator] Chromium executable path:', execPath);
      
      const browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: { width: FLYER_WIDTH, height: FLYER_HEIGHT },
        executablePath: execPath,
        headless: true,
      });
      
      console.log('[FlyerGenerator] @sparticuz/chromium browser launched successfully');
      return browser;
    } catch (err: any) {
      console.error('[FlyerGenerator] @sparticuz/chromium launch failed:', err.message);
      console.error('[FlyerGenerator] Stack:', err.stack);
      throw err;
    }
  } else {
    // Development mode - use local Puppeteer with system Chromium
    console.log('[FlyerGenerator] Using local Puppeteer for development');
    
    const chromiumPath = findChromiumPath();
    console.log('[FlyerGenerator] Using Chromium at:', chromiumPath || 'Puppeteer bundled');
    
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--font-render-hinting=medium',
        '--disable-accelerated-2d-canvas',
        '--disable-software-rasterizer',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--safebrowsing-disable-auto-update'
      ]
    };
    
    if (chromiumPath) {
      launchOptions.executablePath = chromiumPath;
    }
    
    // Try puppeteer-core first with explicit path, fallback to dynamic import of full puppeteer
    try {
      if (chromiumPath) {
        const browser = await puppeteerCore.launch(launchOptions);
        console.log('[FlyerGenerator] Browser launched with puppeteer-core');
        return browser;
      }
    } catch (err) {
      console.log('[FlyerGenerator] puppeteer-core failed, trying full puppeteer...');
    }
    
    // Fallback to full puppeteer package (has bundled Chromium)
    const puppeteerFull = await import('puppeteer');
    const browser = await puppeteerFull.default.launch(launchOptions);
    console.log('[FlyerGenerator] Browser launched with full puppeteer');
    return browser;
  }
}

// Helper function to convert image URL to base64
async function imageToBase64(imageUrl: string): Promise<string> {
  if (!imageUrl) return '';
  
  try {
    // If it's already a data URI, return as-is
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    
    // Check if it's an absolute file path that exists
    if (fs.existsSync(imageUrl)) {
      console.log('Reading local file:', imageUrl);
      const buffer = fs.readFileSync(imageUrl);
      const ext = path.extname(imageUrl).slice(1).toLowerCase();
      const mimeTypes: Record<string, string> = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'svg': 'image/svg+xml',
        'gif': 'image/gif'
      };
      const mimeType = mimeTypes[ext] || 'image/png';
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }
    
    // Handle proxy URLs - extract the actual CDN URL
    if (imageUrl.includes('/api/proxy-image?url=')) {
      const urlMatch = imageUrl.match(/url=([^&]+)/);
      if (urlMatch) {
        imageUrl = decodeURIComponent(urlMatch[1]);
        console.log('Extracted CDN URL from proxy:', imageUrl);
      }
    }
    
    // If it's a local file path starting with /
    if (imageUrl.startsWith('/') && !imageUrl.startsWith('//') && !imageUrl.startsWith('http')) {
      // Check in public directory
      const localPath = path.join(process.cwd(), 'public', imageUrl);
      console.log('Checking local path:', localPath);
      if (fs.existsSync(localPath)) {
        const buffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).slice(1).toLowerCase();
        const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
      }
    }
    
    // Ensure URL is absolute for fetch
    let fetchUrl = imageUrl;
    if (fetchUrl.startsWith('//')) {
      fetchUrl = `https:${fetchUrl}`;
    }
    
    // Must be an http URL to fetch
    if (!fetchUrl.startsWith('http')) {
      console.error('Cannot fetch non-http URL:', fetchUrl);
      return '';
    }
    
    // Fetch remote URL and convert to base64
    console.log('Fetching image:', fetchUrl);
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      console.error('Failed to fetch image:', fetchUrl, response.status);
      return '';
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    console.log('Image fetched successfully, size:', buffer.length, 'type:', contentType);
    return `data:${contentType};base64,${buffer.toString('base64')}`;
    
  } catch (error) {
    console.error('Error converting image to base64:', imageUrl, error);
    return '';
  }
}

function findChromiumPath(): string {
  console.log('[FlyerGenerator] Searching for Chromium...');
  
  // Try environment variable first (set on Render: CHROMIUM_PATH=/usr/bin/chromium)
  if (process.env.CHROMIUM_PATH) {
    console.log('[FlyerGenerator] CHROMIUM_PATH env var:', process.env.CHROMIUM_PATH);
    if (fs.existsSync(process.env.CHROMIUM_PATH)) {
      console.log('[FlyerGenerator] Found Chromium at CHROMIUM_PATH');
      return process.env.CHROMIUM_PATH;
    } else {
      console.log('[FlyerGenerator] CHROMIUM_PATH does not exist on filesystem');
    }
  }
  
  // Common paths to check on various systems (Render, Ubuntu, Debian, etc.)
  const commonPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium'
  ];
  
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      console.log('[FlyerGenerator] Found Chromium at:', p);
      return p;
    }
  }
  
  // Try to find chromium using which
  try {
    const chromiumPath = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (chromiumPath && fs.existsSync(chromiumPath)) {
      console.log('[FlyerGenerator] Found Chromium via which:', chromiumPath);
      return chromiumPath;
    }
  } catch (e) {
    console.log('[FlyerGenerator] which command failed');
  }
  
  // Fallback to common Nix store path (Replit)
  const nixPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  if (fs.existsSync(nixPath)) {
    console.log('[FlyerGenerator] Found Chromium at Nix path');
    return nixPath;
  }
  
  // Let Puppeteer try to find its own bundled browser
  console.log('[FlyerGenerator] No Chromium found, will use Puppeteer default');
  return '';
}

interface ImageTransform {
  scale: number;
  positionX: number;
  positionY: number;
}

export interface FlyerData {
  logoUrl?: string;
  secondaryLogoUrl?: string;
  priceLabel: string;
  price: string;
  fullAddress: string;
  mainImage?: string;
  secondaryImage1?: string;
  secondaryImage2?: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  lotSize?: string;
  headline?: string;
  description: string;
  openHouseDate?: string;
  openHouseTime?: string;
  agentName: string;
  agentTitle: string;
  agentPhone: string;
  agentEmail?: string;
  agentPhoto?: string;
  qrCodeUrl?: string;
  listingUrl?: string;
  statusBadge?: string;
  statusColorClass?: string;
  // Branding controls
  logoScales?: { primary: number; secondary: number };
  dividerPosition?: number;
  secondaryLogoOffsetY?: number;
  // Image transforms for cropping/positioning
  imageTransforms?: {
    mainImage: ImageTransform;
    kitchenImage: ImageTransform;
    roomImage: ImageTransform;
    agentPhoto: ImageTransform;
  };
}

// Template version for cache invalidation
const TEMPLATE_VERSION = 'v3.0.0';

// Icon paths for stat icons - use process.cwd() for CJS compatibility
const ICON_PATHS = {
  bedroom: path.resolve(process.cwd(), 'server/public/icons/bedroom.png'),
  bathroom: path.resolve(process.cwd(), 'server/public/icons/bathroom.png'),
  sqft: path.resolve(process.cwd(), 'server/public/icons/sqft.png')
};

export type OutputType = 'pngPreview' | 'pdf';

// Unified render config - MUST be identical for PNG and PDF for pixel parity
const RENDER_CONFIG = {
  width: FLYER_WIDTH,
  height: FLYER_HEIGHT,
  deviceScaleFactor: 1,
  mediaType: 'print' as const  // Use 'print' for both to match PDF output exactly
};

// Generate deterministic hash for render verification (preview/download parity check)
function generateRenderHash(data: FlyerData, outputSettings: typeof RENDER_CONFIG): string {
  const hashInput = JSON.stringify({
    templateVersion: TEMPLATE_VERSION,
    fullAddress: data.fullAddress,
    price: data.price,
    priceLabel: data.priceLabel,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    sqft: data.sqft,
    lotSize: data.lotSize || '',
    headline: data.headline || '',
    description: data.description,
    openHouseDate: data.openHouseDate || '',
    openHouseTime: data.openHouseTime || '',
    agentName: data.agentName,
    agentTitle: data.agentTitle,
    agentPhone: data.agentPhone,
    agentEmail: data.agentEmail || '',
    statusBadge: data.statusBadge || '',
    hasMainImage: !!data.mainImage,
    hasSecondaryImage1: !!data.secondaryImage1,
    hasSecondaryImage2: !!data.secondaryImage2,
    hasAgentPhoto: !!data.agentPhoto,
    hasQrCode: !!data.qrCodeUrl,
    renderWidth: outputSettings.width,
    renderHeight: outputSettings.height,
    deviceScaleFactor: outputSettings.deviceScaleFactor,
    mediaType: outputSettings.mediaType
  });
  
  return crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
}

export async function generatePrintFlyer(data: FlyerData, outputType: OutputType = 'pngPreview'): Promise<Buffer> {
  // Generate render hash for parity verification
  const renderHash = generateRenderHash(data, RENDER_CONFIG);
  
  console.log(`[FlyerGenerator] ===== RENDER START =====`);
  console.log(`[FlyerGenerator] Output type: ${outputType}`);
  console.log(`[FlyerGenerator] Render hash: ${renderHash}`);
  console.log(`[FlyerGenerator] Template version: ${TEMPLATE_VERSION}`);
  console.log(`[FlyerGenerator] Viewport: ${RENDER_CONFIG.width}x${RENDER_CONFIG.height}`);
  console.log(`[FlyerGenerator] Device scale: ${RENDER_CONFIG.deviceScaleFactor}`);
  console.log(`[FlyerGenerator] Media type: ${RENDER_CONFIG.mediaType}`);
  console.log(`[FlyerGenerator] Converting images to base64...`);
  
  // Default logo paths
  const logoPath = data.logoUrl || path.join(process.cwd(), 'public', 'assets', 'SpyglassRealty_Logo_Black.png');
  const secondaryLogoPath = data.secondaryLogoUrl || path.join(process.cwd(), 'public', 'logos', 'lre-sgr-black.png');
  
  // Convert all images to base64 in parallel (including stat icons)
  const [logoB64, secondaryLogoB64, mainImageB64, secondaryImage1B64, secondaryImage2B64, agentPhotoB64, qrCodeB64, bedroomIconB64, bathroomIconB64, sqftIconB64] = await Promise.all([
    imageToBase64(logoPath),
    imageToBase64(secondaryLogoPath),
    data.mainImage ? imageToBase64(data.mainImage) : Promise.resolve(''),
    data.secondaryImage1 ? imageToBase64(data.secondaryImage1) : Promise.resolve(''),
    data.secondaryImage2 ? imageToBase64(data.secondaryImage2) : Promise.resolve(''),
    data.agentPhoto ? imageToBase64(data.agentPhoto) : Promise.resolve(''),
    data.qrCodeUrl ? imageToBase64(data.qrCodeUrl) : Promise.resolve(''),
    imageToBase64(ICON_PATHS.bedroom),
    imageToBase64(ICON_PATHS.bathroom),
    imageToBase64(ICON_PATHS.sqft)
  ]);
  
  console.log('[FlyerGenerator] Images converted:', {
    logo: logoB64 ? 'OK' : 'FAILED',
    secondaryLogo: secondaryLogoB64 ? 'OK' : 'FAILED',
    mainImage: mainImageB64 ? 'OK' : 'EMPTY',
    secondaryImage1: secondaryImage1B64 ? 'OK' : 'EMPTY',
    secondaryImage2: secondaryImage2B64 ? 'OK' : 'EMPTY',
    agentPhoto: agentPhotoB64 ? 'OK' : 'EMPTY',
    qrCode: qrCodeB64 ? 'OK' : 'EMPTY',
    bedroomIcon: bedroomIconB64 ? 'OK' : 'FAILED',
    bathroomIcon: bathroomIconB64 ? 'OK' : 'FAILED',
    sqftIcon: sqftIconB64 ? 'OK' : 'FAILED'
  });
  
  // Create data with base64 images for template
  // Scale factor: preview is 96 DPI (816px wide), print is 300 DPI (2550px wide)
  // 2550/816 = 3.125 scale factor
  const PRINT_SCALE = 3.125;
  const dividerPos = data.dividerPosition || 148;
  const primaryLogoWidth = Math.round(dividerPos * PRINT_SCALE);
  const logoScales = data.logoScales || { primary: 1, secondary: 1 };
  const secondaryLogoOffsetY = Math.round((data.secondaryLogoOffsetY || 0) * PRINT_SCALE);
  
  // Helper to generate CSS transform style from image transform data
  const getTransformStyle = (transform?: ImageTransform) => {
    if (!transform) return '';
    return `transform: scale(${transform.scale}) translate(${transform.positionX}%, ${transform.positionY}%); transform-origin: center center;`;
  };

  const transforms = data.imageTransforms;

  const dataWithBase64 = {
    ...data,
    logoUrl: logoB64,
    secondaryLogoUrl: secondaryLogoB64,
    mainImage: mainImageB64,
    secondaryImage1: secondaryImage1B64,
    secondaryImage2: secondaryImage2B64,
    agentPhoto: agentPhotoB64,
    qrCodeUrl: qrCodeB64,
    bedroomIcon: bedroomIconB64,
    bathroomIcon: bathroomIconB64,
    sqftIcon: sqftIconB64,
    // Branding controls for template
    primaryLogoWidth,
    primaryLogoScale: logoScales.primary,
    secondaryLogoScale: logoScales.secondary,
    secondaryLogoOffsetY,
    // Image transform styles (CSS strings for template)
    mainImageStyle: getTransformStyle(transforms?.mainImage),
    kitchenImageStyle: getTransformStyle(transforms?.kitchenImage),
    roomImageStyle: getTransformStyle(transforms?.roomImage),
    agentPhotoStyle: getTransformStyle(transforms?.agentPhoto),
  };
  
  const templatePath = path.resolve(process.cwd(), 'server/templates/flyer-template.hbs');
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  
  const template = Handlebars.compile(templateHtml);
  const html = template(dataWithBase64);
  
  // Launch browser using environment-aware function
  console.log('[FlyerGenerator] Launching browser...');
  let browser;
  try {
    browser = await launchBrowser();
    console.log('[FlyerGenerator] Browser launched successfully');
  } catch (launchError: any) {
    console.error('[FlyerGenerator] ===== BROWSER LAUNCH ERROR =====');
    console.error('[FlyerGenerator] Error:', launchError.message);
    console.error('[FlyerGenerator] Stack:', launchError.stack);
    console.error('[FlyerGenerator] isProduction:', isProduction);
    throw new Error(`Failed to launch browser: ${launchError.message}`);
  }
  
  try {
    const page = await browser.newPage();
    
    // ===== UNIFIED RENDER PIPELINE (pixel-identical for PNG and PDF) =====
    
    // 1. Set viewport to exact flyer dimensions
    await page.setViewport({
      width: RENDER_CONFIG.width,
      height: RENDER_CONFIG.height,
      deviceScaleFactor: RENDER_CONFIG.deviceScaleFactor
    });
    
    // 2. Emulate 'print' media type for BOTH outputs to ensure identical CSS behavior
    await page.emulateMediaType(RENDER_CONFIG.mediaType);
    
    // 3. Load HTML content with generous timeout for slower environments
    console.log('[FlyerGenerator] Loading HTML content...');
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 60000  // 60 seconds for Render's slower cold starts
    });
    console.log('[FlyerGenerator] HTML content loaded');
    
    // 4. Wait for fonts to be fully loaded
    await page.evaluate(() => document.fonts && document.fonts.ready);
    
    // 5. Wait for all images to be loaded
    await page.evaluate(async () => {
      const imgs = Array.from(document.images || []);
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.onload = res;
                img.onerror = res;
              })
        )
      );
    });
    
    // 6. Small delay to ensure layout is fully settled
    await new Promise(resolve => setTimeout(resolve, 150));
    
    console.log(`[FlyerGenerator] Page ready, capturing ${outputType}...`);
    
    let result: Buffer;
    
    if (outputType === 'pdf') {
      // Generate PDF with exact pixel dimensions
      const pdf = await page.pdf({
        printBackground: true,
        width: `${RENDER_CONFIG.width}px`,
        height: `${RENDER_CONFIG.height}px`,
        pageRanges: '1',
        preferCSSPageSize: false,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      result = Buffer.from(pdf);
      console.log(`[FlyerGenerator] PDF generated, size: ${result.length} bytes`);
    } else {
      // Generate PNG with exact clip (same dimensions as PDF)
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false,
        clip: { x: 0, y: 0, width: RENDER_CONFIG.width, height: RENDER_CONFIG.height }
      });
      result = Buffer.from(screenshot);
      console.log(`[FlyerGenerator] PNG generated, size: ${result.length} bytes`);
    }
    
    console.log(`[FlyerGenerator] ===== RENDER COMPLETE =====`);
    console.log(`[FlyerGenerator] Output: ${outputType}, Hash: ${renderHash}`);
    
    return result;
  } finally {
    await browser.close();
  }
}

export function formatAddressForFlyer(address: string): string {
  // Simple uppercase formatting - no character splitting
  const normalized = address.toUpperCase().replace(/\s+/g, ' ').trim();
  return normalized;
}
