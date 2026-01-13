/**
 * Repliers Schema Alignment Audit Script
 * 
 * Read-only audit to check alignment between our MLS ingestion and Repliers schema.
 * Does NOT modify any webapp code, routes, or database.
 * 
 * Usage: npx tsx scripts/repliers_schema_audit.ts
 * 
 * Environment variables:
 * - REPLIERS_API_KEY (required)
 * - REPLIERS_BASE_URL (optional, defaults to https://api.repliers.io)
 * - AUDIT_LIMIT (optional, defaults to 50)
 * - AUDIT_QUERY (optional, JSON string of filters)
 */

import * as fs from 'fs';
import * as path from 'path';

const REPLIERS_API_KEY = process.env.REPLIERS_API_KEY;
const REPLIERS_BASE_URL = process.env.REPLIERS_BASE_URL || 'https://api.repliers.io';
const AUDIT_LIMIT = parseInt(process.env.AUDIT_LIMIT || '50', 10);

if (!REPLIERS_API_KEY) {
  console.error('ERROR: REPLIERS_API_KEY environment variable is required');
  process.exit(1);
}

const CRITICAL_FIELDS = {
  identity: ['mlsNumber', 'class', 'type', 'status', 'listPrice', 'listDate'],
  location: ['address', 'address.city', 'address.state', 'address.zip', 'map.latitude', 'map.longitude'],
  permissions: ['permissions.displayAddressOnInternet', 'permissions.displayPublic', 'permissions.displayInternetEntireListing'],
  coreDetails: ['details', 'details.propertyType', 'details.description', 'details.yearBuilt', 'details.sqft', 'details.numBedrooms', 'details.numBathrooms'],
  media: ['images', 'photoCount'],
  dom: ['daysOnMarket', 'simpleDaysOnMarket'],
};

const RENTAL_INDICATORS = ['lease', 'rental', 'rent', 'leasing', 'for rent'];

interface AuditReport {
  run: {
    timestamp: string;
    limit: number;
    query: Record<string, unknown>;
  };
  counts: {
    total: number;
    byStatus: Record<string, number>;
    byClass: Record<string, number>;
  };
  rentals: {
    suspectedCount: number;
    examples: Array<{ mlsNumber: string; evidence: string[] }>;
  };
  criticalFields: {
    missingCounts: Record<string, number>;
    examples: Record<string, string[]>;
  };
  categoryPresence: Record<string, number>;
  typeShapeIssues: Array<{ field: string; expectedType: string; actualTypes: string[]; examples: unknown[] }>;
  samples: {
    exampleListings: Array<{
      mlsNumber: string;
      class: string;
      type: string;
      status: string;
      rawPreview: Record<string, unknown>;
    }>;
  };
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function hasNestedValue(obj: Record<string, unknown>, path: string): boolean {
  const value = getNestedValue(obj, path);
  return value !== undefined && value !== null;
}

function detectRental(listing: Record<string, unknown>): string[] {
  const evidence: string[] = [];
  
  const typeVal = String(listing.type || '').toLowerCase();
  if (RENTAL_INDICATORS.some(ind => typeVal.includes(ind))) {
    evidence.push(`type: "${listing.type}"`);
  }
  
  const detailsType = String((listing.details as Record<string, unknown>)?.propertyType || '').toLowerCase();
  if (RENTAL_INDICATORS.some(ind => detailsType.includes(ind))) {
    evidence.push(`details.propertyType: "${(listing.details as Record<string, unknown>)?.propertyType}"`);
  }
  
  const classVal = String(listing.class || '').toLowerCase();
  if (RENTAL_INDICATORS.some(ind => classVal.includes(ind))) {
    evidence.push(`class: "${listing.class}"`);
  }
  
  if (listing.rent || listing.rentPrice || listing.monthlyRent) {
    evidence.push('has rent-related price field');
  }
  
  return evidence;
}

function getTopKeys(obj: Record<string, unknown>, limit = 50): string[] {
  return Object.keys(obj).slice(0, limit);
}

function truncateObject(obj: Record<string, unknown>, maxKeys = 50): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const keys = Object.keys(obj).slice(0, maxKeys);
  for (const key of keys) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = truncateObject(val as Record<string, unknown>, 10);
    } else if (Array.isArray(val)) {
      result[key] = `[Array(${val.length})]`;
    } else {
      result[key] = val;
    }
  }
  return result;
}

async function fetchListings(): Promise<Record<string, unknown>[]> {
  const query = process.env.AUDIT_QUERY ? JSON.parse(process.env.AUDIT_QUERY) : {};
  
  const params = new URLSearchParams({
    resultsPerPage: String(AUDIT_LIMIT),
    ...query
  });
  
  const url = `${REPLIERS_BASE_URL}/listings?${params.toString()}`;
  
  console.log(`Fetching ${AUDIT_LIMIT} listings from Repliers...`);
  console.log(`URL: ${url.replace(REPLIERS_API_KEY!, '[REDACTED]')}`);
  
  const response = await fetch(url, {
    headers: {
      'REPLIERS-API-KEY': REPLIERS_API_KEY!,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`HTTP ${response.status}: ${errorBody.substring(0, 500)}`);
    process.exit(1);
  }
  
  const data = await response.json() as { listings?: Record<string, unknown>[] };
  return data.listings || [];
}

function analyzeTypeConsistency(listings: Record<string, unknown>[]): Map<string, Set<string>> {
  const typeMap = new Map<string, Set<string>>();
  
  const fieldsToCheck = [
    'listPrice', 'daysOnMarket', 'simpleDaysOnMarket', 'photoCount',
    'details.sqft', 'details.numBedrooms', 'details.numBathrooms', 'details.yearBuilt',
    'map.latitude', 'map.longitude'
  ];
  
  for (const listing of listings) {
    for (const field of fieldsToCheck) {
      const value = getNestedValue(listing, field);
      if (value !== undefined && value !== null) {
        if (!typeMap.has(field)) {
          typeMap.set(field, new Set());
        }
        typeMap.get(field)!.add(typeof value);
      }
    }
  }
  
  return typeMap;
}

async function runAudit(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log('\n' + '='.repeat(80));
  console.log('REPLIERS SCHEMA ALIGNMENT AUDIT');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Limit: ${AUDIT_LIMIT}`);
  console.log(`Base URL: ${REPLIERS_BASE_URL}`);
  console.log('='.repeat(80) + '\n');
  
  const listings = await fetchListings();
  
  if (listings.length === 0) {
    console.log('No listings returned from API.');
    process.exit(0);
  }
  
  console.log(`Fetched ${listings.length} listings\n`);
  
  const report: AuditReport = {
    run: {
      timestamp,
      limit: AUDIT_LIMIT,
      query: process.env.AUDIT_QUERY ? JSON.parse(process.env.AUDIT_QUERY) : {},
    },
    counts: {
      total: listings.length,
      byStatus: {},
      byClass: {},
    },
    rentals: {
      suspectedCount: 0,
      examples: [],
    },
    criticalFields: {
      missingCounts: {},
      examples: {},
    },
    categoryPresence: {},
    typeShapeIssues: [],
    samples: {
      exampleListings: [],
    },
  };
  
  for (const listing of listings) {
    const status = String(listing.status || listing.standardStatus || 'unknown');
    report.counts.byStatus[status] = (report.counts.byStatus[status] || 0) + 1;
    
    const listingClass = String(listing.class || 'unknown');
    report.counts.byClass[listingClass] = (report.counts.byClass[listingClass] || 0) + 1;
  }
  
  for (const listing of listings) {
    const evidence = detectRental(listing);
    if (evidence.length > 0) {
      report.rentals.suspectedCount++;
      if (report.rentals.examples.length < 10) {
        report.rentals.examples.push({
          mlsNumber: String(listing.mlsNumber || 'N/A'),
          evidence,
        });
      }
    }
  }
  
  const allCriticalFields = Object.values(CRITICAL_FIELDS).flat();
  for (const field of allCriticalFields) {
    report.criticalFields.missingCounts[field] = 0;
    report.criticalFields.examples[field] = [];
  }
  
  for (const listing of listings) {
    for (const field of allCriticalFields) {
      if (!hasNestedValue(listing, field)) {
        report.criticalFields.missingCounts[field]++;
        if (report.criticalFields.examples[field].length < 3) {
          report.criticalFields.examples[field].push(String(listing.mlsNumber || 'N/A'));
        }
      }
    }
  }
  
  const categories = {
    'Basic Info': ['mlsNumber', 'class', 'type'],
    'Pricing': ['listPrice', 'originalPrice', 'soldPrice'],
    'Status/Lifecycle': ['status', 'standardStatus', 'listDate', 'soldDate'],
    'Location': ['address', 'map'],
    'Permissions': ['permissions'],
    'Details': ['details'],
    'Financial': ['taxes', 'details.maintenance', 'details.association'],
    'Features': ['heating', 'cooling', 'details.heating', 'details.cooling'],
    'Media': ['images', 'photoCount'],
    'DOM': ['daysOnMarket', 'simpleDaysOnMarket'],
    'Class-specific': ['residential', 'condominium', 'commercial'],
  };
  
  for (const [category, fields] of Object.entries(categories)) {
    let present = 0;
    for (const listing of listings) {
      for (const field of fields) {
        if (hasNestedValue(listing, field)) {
          present++;
          break;
        }
      }
    }
    report.categoryPresence[category] = Math.round((present / listings.length) * 100);
  }
  
  const typeConsistency = analyzeTypeConsistency(listings);
  for (const [field, types] of typeConsistency.entries()) {
    if (types.size > 1) {
      const examples: unknown[] = [];
      for (const listing of listings.slice(0, 3)) {
        const val = getNestedValue(listing, field);
        if (val !== undefined) examples.push(val);
      }
      report.typeShapeIssues.push({
        field,
        expectedType: 'number',
        actualTypes: Array.from(types),
        examples,
      });
    }
  }
  
  for (const listing of listings.slice(0, 5)) {
    report.samples.exampleListings.push({
      mlsNumber: String(listing.mlsNumber || 'N/A'),
      class: String(listing.class || 'N/A'),
      type: String(listing.type || 'N/A'),
      status: String(listing.status || listing.standardStatus || 'N/A'),
      rawPreview: truncateObject(listing),
    });
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log('SUMMARY');
  console.log('-'.repeat(80));
  console.log(`Total records fetched: ${report.counts.total}`);
  
  console.log('\nRecords by Status (top 10):');
  const statusEntries = Object.entries(report.counts.byStatus)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [status, count] of statusEntries) {
    console.log(`  ${status}: ${count}`);
  }
  
  console.log('\nRecords by Class (top 10):');
  const classEntries = Object.entries(report.counts.byClass)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [cls, count] of classEntries) {
    console.log(`  ${cls}: ${count}`);
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log('RENTALS/LEASING DETECTION');
  console.log('-'.repeat(80));
  console.log(`Suspected rentals: ${report.rentals.suspectedCount}`);
  if (report.rentals.examples.length > 0) {
    console.log('Examples:');
    for (const ex of report.rentals.examples) {
      console.log(`  ${ex.mlsNumber}: ${ex.evidence.join(', ')}`);
    }
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log('CRITICAL FIELDS - MISSING COUNTS');
  console.log('-'.repeat(80));
  for (const [category, fields] of Object.entries(CRITICAL_FIELDS)) {
    console.log(`\n${category.toUpperCase()}:`);
    for (const field of fields) {
      const missing = report.criticalFields.missingCounts[field];
      const pct = Math.round((missing / listings.length) * 100);
      const status = missing === 0 ? '✓' : missing === listings.length ? '✗' : '~';
      console.log(`  ${status} ${field}: ${missing} missing (${pct}%)`);
    }
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log('CATEGORY PRESENCE (%)');
  console.log('-'.repeat(80));
  for (const [category, pct] of Object.entries(report.categoryPresence)) {
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    console.log(`  ${category.padEnd(20)} ${bar} ${pct}%`);
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log('TYPE SHAPE ISSUES');
  console.log('-'.repeat(80));
  if (report.typeShapeIssues.length === 0) {
    console.log('No type inconsistencies detected.');
  } else {
    for (const issue of report.typeShapeIssues) {
      console.log(`  ${issue.field}: expected ${issue.expectedType}, found [${issue.actualTypes.join(', ')}]`);
      console.log(`    examples: ${JSON.stringify(issue.examples)}`);
    }
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log('SAMPLE LISTINGS (first 5)');
  console.log('-'.repeat(80));
  for (const sample of report.samples.exampleListings) {
    console.log(`\n  MLS#: ${sample.mlsNumber}`);
    console.log(`  Class: ${sample.class}`);
    console.log(`  Type: ${sample.type}`);
    console.log(`  Status: ${sample.status}`);
    console.log(`  Top keys: ${getTopKeys(sample.rawPreview, 15).join(', ')}`);
  }
  
  const artifactsDir = path.join(process.cwd(), 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  
  const reportPath = path.join(artifactsDir, 'repliers-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(80));
  console.log(`Report written to: ${reportPath}`);
  console.log('');
}

runAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
