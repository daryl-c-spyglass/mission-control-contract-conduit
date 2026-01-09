import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { execSync } from 'child_process';

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
  const templatePath = path.join(import.meta.dirname, '../templates/flyer-template.html');
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  
  const template = Handlebars.compile(templateHtml);
  const html = template(data);
  
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
  const parts = address.split(',');
  const streetAddress = parts[0].trim().toUpperCase();
  const cityStateZip = parts.slice(1).join(',').trim().toUpperCase();
  
  const formatWord = (word: string): string => {
    if (/^\d+$/.test(word)) {
      return word;
    }
    if (/^(TX|CA|NY|FL|AZ|CO|GA|NC|OH|PA|IL|NJ|VA|WA|MA|MD|TN|IN|MO|WI|MN|SC|AL|LA|KY|OR|OK|CT|IA|MS|AR|KS|UT|NV|NM|WV|NE|ID|HI|ME|NH|RI|MT|DE|SD|ND|AK|VT|WY|DC)$/i.test(word)) {
      return word;
    }
    if (/^\d{5}(-\d{4})?$/.test(word)) {
      return word;
    }
    return word.split('').join(' ');
  };
  
  const formatSection = (section: string): string => {
    return section.split(' ').filter(w => w).map(formatWord).join('   ');
  };
  
  if (cityStateZip) {
    return `${formatSection(streetAddress)}   ${formatSection(cityStateZip)}`;
  }
  return formatSection(streetAddress);
}
