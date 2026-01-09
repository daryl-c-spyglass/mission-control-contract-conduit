import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { execSync } from 'child_process';

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

export async function generatePrintFlyer(data: FlyerData): Promise<Buffer> {
  console.log('Converting images to base64...');
  
  // Convert all images to base64 in parallel
  const [logoB64, mainPhotoB64, photo2B64, photo3B64, agentPhotoB64] = await Promise.all([
    imageToBase64(data.spyglassLogoUrl),
    data.mainPhoto ? imageToBase64(data.mainPhoto) : Promise.resolve(''),
    data.photo2 ? imageToBase64(data.photo2) : Promise.resolve(''),
    data.photo3 ? imageToBase64(data.photo3) : Promise.resolve(''),
    data.agentPhoto ? imageToBase64(data.agentPhoto) : Promise.resolve('')
  ]);
  
  console.log('Images converted:', {
    logo: logoB64 ? 'OK' : 'FAILED',
    mainPhoto: mainPhotoB64 ? 'OK' : 'FAILED/EMPTY',
    photo2: photo2B64 ? 'OK' : 'FAILED/EMPTY',
    photo3: photo3B64 ? 'OK' : 'FAILED/EMPTY',
    agentPhoto: agentPhotoB64 ? 'OK' : 'EMPTY'
  });
  
  // Create data with base64 images
  const dataWithBase64 = {
    ...data,
    spyglassLogoUrl: logoB64,
    mainPhoto: mainPhotoB64,
    photo2: photo2B64,
    photo3: photo3B64,
    agentPhoto: agentPhotoB64
  };
  
  const templatePath = path.join(import.meta.dirname, '../templates/flyer-template.html');
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  
  const template = Handlebars.compile(templateHtml);
  const html = template(dataWithBase64);
  
  // Find system-installed Chromium
  const chromiumPath = findChromiumPath();
  console.log('Using Chromium at:', chromiumPath || 'Puppeteer default');
  
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
      '--disable-extensions'
    ]
  };
  
  if (chromiumPath) {
    launchOptions.executablePath = chromiumPath;
  }
  
  const browser = await puppeteer.launch(launchOptions);
  
  try {
    const page = await browser.newPage();
    
    await page.setViewport({
      width: 2550,
      height: 3300,
      deviceScaleFactor: 1
    });
    
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    await page.waitForFunction(() => {
      const images = document.querySelectorAll('img');
      return Array.from(images).every(img => img.complete);
    }, { timeout: 15000 }).catch(() => {
    });
    
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true
    });
    
    return screenshot as Buffer;
  } finally {
    await browser.close();
  }
}

export function formatAddressForFlyer(address: string): string {
  // Simple uppercase formatting - no character splitting
  // Just normalize spacing and uppercase
  const normalized = address.toUpperCase().replace(/\s+/g, ' ').trim();
  return normalized;
}
