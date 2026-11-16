import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const targetDirectory = fileURLToPath(new URL('../dist/integrations/urban/', import.meta.url));
await mkdir(targetDirectory, { recursive: true });
for (const name of ['infosiga_extract.py', 'ssp_crimes_extract.py'])
  await copyFile(
    fileURLToPath(new URL(`../src/integrations/urban/${name}`, import.meta.url)),
    `${targetDirectory}${name}`,
  );
