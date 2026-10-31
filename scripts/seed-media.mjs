/* global process, console, fetch, Buffer */
// Upload images to Sanity as image assets and print their asset IDs.
//   node scripts/seed-media.mjs              → the stock photos below
//   node scripts/seed-media.mjs <file> ...   → local files, e.g. her artwork
// Her own files are passed in by path and never committed (public repo).
// Shai runs this; the write token stays in .env and never leaves this machine.
// Re-running is harmless: Sanity deduplicates identical files by hash.
// See docs/superpowers/specs/2026-10-30-scroll-story-design.md §8a.

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file — the check below names what is missing.
}

const REQUIRED = [
  'PUBLIC_SANITY_PROJECT_ID',
  'PUBLIC_SANITY_DATASET',
  'SANITY_WRITE_TOKEN',
];
const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`seed-media: missing ${missing.join(', ')} in .env`);
  process.exit(1);
}

// Unsplash License: free to use, no attribution required.
const UNSPLASH = 'https://images.unsplash.com';
const SOURCES = [
  { key: 'cosmetics', id: '1512496015851-a90fb38ba796' },
  { key: 'blush', id: '1773688189414-7637b9b138e1' },
  { key: 'lashes', id: '1774814305111-8298b8cde459' },
  { key: 'veil', id: '1779675257929-ae3dbf2ad924' },
  { key: 'kit', id: '1764269719546-afc8567db7c6' },
  { key: 'bride', id: '1774814304885-bb5cc796a6c3' },
];

const { createClient } = await import('@sanity/client');
const client = createClient({
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.PUBLIC_SANITY_DATASET,
  token: process.env.SANITY_WRITE_TOKEN,
  apiVersion: '2025-01-01',
  useCdn: false,
});

async function upload(key, buffer, filename) {
  const asset = await client.assets.upload('image', buffer, { filename });
  const { width, height } = asset.metadata.dimensions;
  console.error(`seed-media: uploaded ${key}`);
  return { key, assetId: asset._id, width, height };
}

const results = [];
const files = process.argv.slice(2);
if (files.length) {
  const { readFile } = await import('node:fs/promises');
  const { basename } = await import('node:path');
  for (const file of files) {
    const name = basename(file);
    results.push(await upload(name, await readFile(file), name));
  }
} else {
  for (const { key, id } of SOURCES) {
    const res = await fetch(`${UNSPLASH}/photo-${id}?w=2000&fm=jpg&q=85`);
    if (!res.ok) {
      console.error(`seed-media: ${key} download failed (${res.status})`);
      process.exit(1);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    results.push(await upload(key, buffer, `${key}.jpg`));
  }
}

console.log(JSON.stringify(results, null, 2));
