const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const targetIdlDir = path.join(projectRoot, 'target', 'idl');
const targetTypesDir = path.join(projectRoot, 'target', 'types');
const frontendTargetDir = path.join(projectRoot, 'frontend', 'target', 'types');

// Ensure frontend target directory exists
if (!fs.existsSync(frontendTargetDir)) {
    fs.mkdirSync(frontendTargetDir, { recursive: true });
}

// Copy IDL JSON
const idlFile = 'solana_vault.json';
const sourceIdlPath = path.join(targetIdlDir, idlFile);
const destIdlPath = path.join(frontendTargetDir, idlFile);

if (fs.existsSync(sourceIdlPath)) {
    fs.copyFileSync(sourceIdlPath, destIdlPath);
    console.log(`Copied ${idlFile} to frontend.`);
} else {
    console.error(`Error: ${sourceIdlPath} not found. Run 'anchor build' first.`);
}

// Copy TypeScript types
const typesFile = 'solana_vault.ts';
// Note: recursive search for types file in target/types might be needed if structure varies, 
// but standard anchor output is usually flat in target/types for the program.
const sourceTypesPath = path.join(targetTypesDir, typesFile);
const destTypesPath = path.join(frontendTargetDir, typesFile);

if (fs.existsSync(sourceTypesPath)) {
    fs.copyFileSync(sourceTypesPath, destTypesPath);
    console.log(`Copied ${typesFile} to frontend.`);
} else {
    console.warn(`Warning: ${sourceTypesPath} not found. Types might not be generated yet.`);
}
