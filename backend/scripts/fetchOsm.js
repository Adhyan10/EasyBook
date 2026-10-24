import { mkdir, writeFile } from 'node:fs/promises';
import { sanitizeElement } from '../src/seed/sanitizeOsm.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SNAPSHOT_URL = new URL('./data/bangalore-osm.json', import.meta.url);
const MAX_ELEMENTS = 600;
const QUERY = `
[out:json][timeout:120];
area["boundary"="administrative"]["name:en"="Bengaluru"]->.city;
(
  node["amenity"="restaurant"]["name"](area.city);
  way["amenity"="restaurant"]["name"](area.city);
);
out center tags ${MAX_ELEMENTS};
`;

async function main() {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'EasyBook-seed/1.0 (student project)' },
    body: `data=${encodeURIComponent(QUERY)}`,
  });
  if (!response.ok) throw new Error(`Overpass responded with HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.elements)) throw new Error('Overpass response had no elements array');

  await mkdir(new URL('./data/', import.meta.url), { recursive: true });
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    source: 'OpenStreetMap contributors (ODbL), via Overpass API',
    elements: payload.elements.map(sanitizeElement),
  };
  await writeFile(SNAPSHOT_URL, `${JSON.stringify(snapshot)}\n`);
  process.stdout.write(`Saved ${payload.elements.length} elements to scripts/data/bangalore-osm.json\n`);
}

main().catch((err) => {
  process.stderr.write(`Fetch failed: ${err.message}\n`);
  process.exit(1);
});
