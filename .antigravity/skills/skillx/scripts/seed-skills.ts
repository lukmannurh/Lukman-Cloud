#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_URL = process.env.API_URL || 'http://localhost:5173';
const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function seedSkills() {
  if (!ADMIN_SECRET) {
    console.error('Error: ADMIN_SECRET environment variable is required');
    console.error('Usage: ADMIN_SECRET=your-secret-key npm run seed');
    process.exit(1);
  }

  try {
    // Read seed data
    const seedDataPath = join(__dirname, 'seed-data.json');
    const seedData = await readFile(seedDataPath, 'utf-8');
    const skills = JSON.parse(seedData);

    console.log(`Seeding ${skills.length} skills to ${API_URL}/api/admin/seed...`);

    // POST to seed endpoint
    const response = await fetch(`${API_URL}/api/admin/seed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': ADMIN_SECRET,
      },
      body: seedData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('\n✅ Seeding complete!');
    console.log(`   Skills: ${result.skills}`);
    console.log(`   Vectors: ${result.vectors}`);
  } catch (error) {
    console.error('\n❌ Seeding failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

seedSkills();
