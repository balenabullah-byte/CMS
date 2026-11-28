import { fileURLToPath } from 'node:url';

// Resolve relative to the API, including when launched from another directory.
try {
  process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
