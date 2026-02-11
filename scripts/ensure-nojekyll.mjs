
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distributionDir = path.resolve(__dirname, '../dist');
const noJekyllPath = path.join(distributionDir, '.nojekyll');

// Ensure dist directory exists (it should after build)
if (fs.existsSync(distributionDir)) {
    fs.writeFileSync(noJekyllPath, '');
    console.log('✅ Created .nojekyll in dist/');
} else {
    console.warn('⚠️  dist/ directory not found. Make sure this script runs after build.');
}
