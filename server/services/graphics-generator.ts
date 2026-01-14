import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { execSync } from 'child_process';

export type GraphicsFormat = 'square' | 'story' | 'landscape';

export interface GraphicsData {
  photoUrl: string;
  status: string;
  description?: string;
  address: string;
  price: string;
  beds: string;
  baths: string;
  sqft: string;
  brokerageLogo?: string;
}

const FORMAT_DIMENSIONS: Record<GraphicsFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1200, height: 630 },
};

const STATUS_COLORS: Record<string, string> = {
  'Just Listed': '#22c55e',
  'Open House': '#3b82f6',
  'Price Reduced': '#f59e0b',
  'Under Contract': '#8b5cf6',
  'Pending': '#8b5cf6',
  'Coming Soon': '#06b6d4',
  'Just Sold': '#ef4444',
};

async function imageToBase64(imageUrl: string): Promise<string> {
  if (!imageUrl) return '';
  
  try {
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    
    if (fs.existsSync(imageUrl)) {
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
    
    if (imageUrl.includes('/api/proxy-image?url=')) {
      const urlMatch = imageUrl.match(/url=([^&]+)/);
      if (urlMatch) {
        imageUrl = decodeURIComponent(urlMatch[1]);
      }
    }
    
    if (imageUrl.startsWith('/') && !imageUrl.startsWith('//') && !imageUrl.startsWith('http')) {
      const localPath = path.join(process.cwd(), 'public', imageUrl);
      if (fs.existsSync(localPath)) {
        const buffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).slice(1).toLowerCase();
        const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
      }
    }
    
    let fetchUrl = imageUrl;
    if (fetchUrl.startsWith('//')) {
      fetchUrl = `https:${fetchUrl}`;
    }
    
    if (!fetchUrl.startsWith('http')) {
      console.error('[GraphicsGenerator] Cannot fetch non-http URL:', fetchUrl);
      return '';
    }
    
    console.log('[GraphicsGenerator] Fetching image:', fetchUrl);
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      console.error('[GraphicsGenerator] Failed to fetch image:', fetchUrl, response.status);
      return '';
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
    
  } catch (error) {
    console.error('[GraphicsGenerator] Error converting image to base64:', imageUrl, error);
    return '';
  }
}

function findChromiumPath(): string {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  
  try {
    const chromiumPath = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (chromiumPath && fs.existsSync(chromiumPath)) {
      return chromiumPath;
    }
  } catch (e) {
  }
  
  const nixPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  if (fs.existsSync(nixPath)) {
    return nixPath;
  }
  
  return '';
}

export async function generateGraphic(data: GraphicsData, format: GraphicsFormat): Promise<Buffer> {
  console.log(`[GraphicsGenerator] ===== RENDER START =====`);
  console.log(`[GraphicsGenerator] Format: ${format}`);
  console.log(`[GraphicsGenerator] Status: ${data.status}`);
  console.log(`[GraphicsGenerator] Address: ${data.address}`);
  
  const dimensions = FORMAT_DIMENSIONS[format];
  if (!dimensions) {
    throw new Error(`Invalid graphics format: ${format}`);
  }
  
  const [photoBase64, logoBase64] = await Promise.all([
    imageToBase64(data.photoUrl),
    data.brokerageLogo ? imageToBase64(data.brokerageLogo) : Promise.resolve('')
  ]);
  
  if (!photoBase64) {
    throw new Error('Failed to load property photo');
  }
  
  const templatePath = path.resolve(process.cwd(), `server/templates/graphics/${format}.hbs`);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${format}.hbs`);
  }
  
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(templateHtml);
  
  const statusColor = STATUS_COLORS[data.status] || '#22c55e';
  
  const html = template({
    photoBase64,
    brokerageLogo: logoBase64,
    status: data.status,
    statusColor,
    description: data.description,
    address: data.address,
    price: data.price,
    beds: data.beds,
    baths: data.baths,
    sqft: data.sqft,
  });
  
  const chromiumPath = findChromiumPath();
  console.log('[GraphicsGenerator] Using Chromium at:', chromiumPath || 'Puppeteer default');
  
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
    
    await page.setViewport({
      width: dimensions.width,
      height: dimensions.height,
      deviceScaleFactor: 1
    });
    
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    await page.evaluate(() => document.fonts && document.fonts.ready);
    
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
    
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width: dimensions.width,
        height: dimensions.height
      }
    });
    
    console.log(`[GraphicsGenerator] ===== RENDER COMPLETE =====`);
    console.log(`[GraphicsGenerator] Output size: ${screenshot.length} bytes`);
    
    return Buffer.from(screenshot);
    
  } finally {
    await browser.close();
  }
}

export function getFormatDimensions(format: GraphicsFormat): { width: number; height: number } {
  return FORMAT_DIMENSIONS[format];
}

export function getFormatLabel(format: GraphicsFormat): string {
  const labels: Record<GraphicsFormat, string> = {
    square: 'Instagram Post',
    story: 'Instagram Story',
    landscape: 'Facebook Post',
  };
  return labels[format];
}
