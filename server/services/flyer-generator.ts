import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { execSync } from 'child_process';
import crypto from 'crypto';

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
  // Try environment variable first
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  
  // Try to find chromium using which
  try {
    const chromiumPath = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (chromiumPath && fs.existsSync(chromiumPath)) {
      return chromiumPath;
    }
  } catch (e) {
    // Ignore error
  }
  
  // Fallback to common Nix store path
  const nixPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  if (fs.existsSync(nixPath)) {
    return nixPath;
  }
  
  // Let Puppeteer try to find its own
  return '';
}

export interface FlyerData {
  spyglassLogoUrl: string;
  statusLabel: string;
  price: string;
  address: string;
  mainPhoto?: string;
  photo2?: string;
  photo3?: string;
  beds: string;
  baths: string;
  sqft: string;
  headline?: string;
  description: string;
  agentName: string;
  agentTitle: string;
  agentPhone: string;
  agentPhoto?: string;
}

// 8.5x11 at 300 DPI
const FLYER_WIDTH = 2550;
const FLYER_HEIGHT = 3300;

// Template version for cache invalidation
const TEMPLATE_VERSION = 'v2.4.2';

// Icon paths for stat icons
const ICON_PATHS = {
  bedroom: path.join(import.meta.dirname, '../public/icons/bedroom.png'),
  bathroom: path.join(import.meta.dirname, '../public/icons/bathroom.png'),
  sqft: path.join(import.meta.dirname, '../public/icons/sqft.png')
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
    // Only include layout-affecting data (not image content which is huge)
    address: data.address,
    price: data.price,
    statusLabel: data.statusLabel,
    beds: data.beds,
    baths: data.baths,
    sqft: data.sqft,
    headline: data.headline || '',
    description: data.description,
    agentName: data.agentName,
    agentTitle: data.agentTitle,
    agentPhone: data.agentPhone,
    hasMainPhoto: !!data.mainPhoto,
    hasPhoto2: !!data.photo2,
    hasPhoto3: !!data.photo3,
    hasAgentPhoto: !!data.agentPhoto,
    // Output settings
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
  
  // Convert all images to base64 in parallel (including stat icons)
  const [logoB64, mainPhotoB64, photo2B64, photo3B64, agentPhotoB64, bedroomIconB64, bathroomIconB64, sqftIconB64] = await Promise.all([
    imageToBase64(data.spyglassLogoUrl),
    data.mainPhoto ? imageToBase64(data.mainPhoto) : Promise.resolve(''),
    data.photo2 ? imageToBase64(data.photo2) : Promise.resolve(''),
    data.photo3 ? imageToBase64(data.photo3) : Promise.resolve(''),
    data.agentPhoto ? imageToBase64(data.agentPhoto) : Promise.resolve(''),
    imageToBase64(ICON_PATHS.bedroom),
    imageToBase64(ICON_PATHS.bathroom),
    imageToBase64(ICON_PATHS.sqft)
  ]);
  
  console.log('[FlyerGenerator] Images converted:', {
    logo: logoB64 ? 'OK' : 'FAILED',
    mainPhoto: mainPhotoB64 ? 'OK' : 'EMPTY',
    photo2: photo2B64 ? 'OK' : 'EMPTY',
    photo3: photo3B64 ? 'OK' : 'EMPTY',
    agentPhoto: agentPhotoB64 ? 'OK' : 'EMPTY',
    bedroomIcon: bedroomIconB64 ? 'OK' : 'FAILED',
    bathroomIcon: bathroomIconB64 ? 'OK' : 'FAILED',
    sqftIcon: sqftIconB64 ? 'OK' : 'FAILED'
  });
  
  // Create data with base64 images
  const dataWithBase64 = {
    ...data,
    spyglassLogoUrl: logoB64,
    mainPhoto: mainPhotoB64,
    photo2: photo2B64,
    photo3: photo3B64,
    agentPhoto: agentPhotoB64,
    bedroomIcon: bedroomIconB64,
    bathroomIcon: bathroomIconB64,
    sqftIcon: sqftIconB64
  };
  
  const templatePath = path.join(import.meta.dirname, '../templates/flyer-template.html');
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  
  const template = Handlebars.compile(templateHtml);
  const html = template(dataWithBase64);
  
  // Find system-installed Chromium
  const chromiumPath = findChromiumPath();
  console.log('[FlyerGenerator] Using Chromium at:', chromiumPath || 'Puppeteer default');
  
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
      '--font-render-hinting=medium'
    ]
  };
  
  if (chromiumPath) {
    launchOptions.executablePath = chromiumPath;
  }
  
  const browser = await puppeteer.launch(launchOptions);
  
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
    
    // 3. Load HTML content
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
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
