import { createModuleLogger } from './logger';

const log = createModuleLogger('env-guard');

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  { name: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
  { name: 'REPLIERS_API_KEY', required: false, description: 'Repliers MLS API key' },
  { name: 'SLACK_BOT_TOKEN', required: false, description: 'Slack bot token for notifications' },
  { name: 'OPENAI_API_KEY', required: false, description: 'OpenAI API key for AI features' },
  { name: 'GOOGLE_MAPS_API_KEY', required: false, description: 'Google Maps API key' },
  { name: 'MAPBOX_TOKEN', required: false, description: 'Mapbox token for maps' },
];

export function validateEnvironment(): { valid: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    if (!process.env[envVar.name]) {
      if (envVar.required) {
        missing.push(`${envVar.name} (${envVar.description})`);
      } else {
        warnings.push(`${envVar.name} not set - ${envVar.description} will be unavailable`);
      }
    }
  }

  if (missing.length > 0) {
    log.error({ missing }, 'Required environment variables missing');
  }

  if (warnings.length > 0) {
    log.warn({ warnings }, 'Optional environment variables missing');
  }

  if (missing.length === 0 && warnings.length === 0) {
    log.info('All environment variables validated');
  }

  return { valid: missing.length === 0, missing, warnings };
}
