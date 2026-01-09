import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';

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
  
  Handlebars.registerHelper('if', function(this: any, conditional: any, options: any) {
    if (conditional) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  });
  
  const template = Handlebars.compile(templateHtml);
  const html = template(data);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ]
  });
  
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
    return word.split('').join(' ');
  };
  
  const formatSection = (section: string): string => {
    return section.split(' ').map(formatWord).join('   ');
  };
  
  if (cityStateZip) {
    return `${formatSection(streetAddress)}   ${formatSection(cityStateZip)}`;
  }
  return formatSection(streetAddress);
}
