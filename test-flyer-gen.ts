import { generatePrintFlyer, formatAddressForFlyer, type FlyerData } from './server/services/flyer-generator.js';
import fs from 'fs';
import path from 'path';

async function testFlyerGeneration() {
  console.log('Starting flyer generation test...');
  
  const logoPath = path.join(process.cwd(), 'public', 'assets', 'SpyglassRealty_Logo_Black.png');
  console.log('Logo path:', logoPath);
  console.log('Logo exists:', fs.existsSync(logoPath));
  
  const testData: FlyerData = {
    spyglassLogoUrl: logoPath,
    statusLabel: 'FOR SALE AT',
    price: '$450,000',
    address: formatAddressForFlyer('13106 New Boston, Austin, TX 78701'),
    mainPhoto: 'https://cdn.repliers.io/unlock-mls/IMG-ACT2572987_2.jpg',
    photo2: 'https://cdn.repliers.io/unlock-mls/IMG-ACT2572987_3.jpg',
    photo3: 'https://cdn.repliers.io/unlock-mls/IMG-ACT2572987_10.jpg',
    beds: '4',
    baths: '3',
    sqft: '2,500',
    headline: 'MOVE-IN READY IN NW AUSTIN',
    description: 'Beautiful home in a prime location with stunning views and modern finishes throughout.',
    agentName: 'Test Agent',
    agentTitle: 'REALTOR®',
    agentPhone: '512-555-1234'
  };
  
  console.log('Formatted address:', testData.address);
  console.log('Generating flyer...');
  
  try {
    const pngBuffer = await generatePrintFlyer(testData);
    const outputPath = '/tmp/test_flyer_output.png';
    fs.writeFileSync(outputPath, pngBuffer);
    console.log('Flyer generated successfully!');
    console.log('Output saved to:', outputPath);
    console.log('File size:', pngBuffer.length, 'bytes');
  } catch (error) {
    console.error('Error generating flyer:', error);
  }
}

testFlyerGeneration();
