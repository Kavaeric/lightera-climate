/**
 * Reformat JSONC colourmap files to use compact single-line stops
 * Run with: npx tsx scripts/reformatColourmaps.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const definitionsDir = path.join(__dirname, '..', 'src', 'rendering', 'colourmaps', 'definitions');

// Get all JSONC files except schema
const files = fs.readdirSync(definitionsDir)
  .filter(f => f.endsWith('.jsonc') && f !== 'schema.jsonc');

console.log(`Reformatting ${files.length} colourmap files...`);

for (const filename of files) {
  const filepath = path.join(definitionsDir, filename);
  const content = fs.readFileSync(filepath, 'utf-8');

  // Extract comments at the top
  const lines = content.split('\n');
  const comments: string[] = [];
  let jsonStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('//')) {
      comments.push(lines[i]);
    } else if (trimmed === '{') {
      jsonStart = i;
      break;
    }
  }

  // Parse the JSON (remove comments for parsing)
  const jsonContent = lines.slice(jsonStart).join('\n');
  const jsonWithoutComments = jsonContent.replace(/\/\/.*/g, '');
  const data = JSON.parse(jsonWithoutComments);

  // Format the stops on single lines
  let output = comments.join('\n');
  if (comments.length > 0) output += '\n';

  output += '{\n';
  output += `  "name": "${data.name}",\n`;
  output += '  "stops": [\n';

  data.stops.forEach((stop: any, i: number) => {
    const comma = i < data.stops.length - 1 ? ',' : '';
    output += `    { "position": ${stop.position}, "color": [${stop.color.join(', ')}] }${comma}\n`;
  });

  output += '  ],\n';
  output += `  "underflowColour": [${data.underflowColour.join(', ')}],\n`;
  output += `  "overflowColour": [${data.overflowColour.join(', ')}]\n`;
  output += '}\n';

  fs.writeFileSync(filepath, output, 'utf-8');
  console.log(`  ✓ ${filename}`);
}

console.log('\nReformatting complete!');
