#!/usr/bin/env node

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

// Get current file's directory with ESM support
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, "../assets");
const targetDir = path.resolve(__dirname, "../src/shared/assets");

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Get all PNG files from the assets directory
const pngFiles = fs
  .readdirSync(sourceDir)
  .filter((file) => file.toLowerCase().endsWith(".png"));

// Process each PNG file
async function processPngFile(filename: string): Promise<void> {
  const inputPath = path.join(sourceDir, filename);
  const baseName = path.basename(filename, ".png");
  const outputPath = path.join(targetDir, `${baseName}.ts`);

  try {
    // Load the image
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    if (!width || !height) {
      throw new Error("Could not determine image dimensions");
    }

    // Get raw pixel data
    const { data } = await image.raw().toBuffer({ resolveWithObject: true });

    const rgbArray: number[] = [];
    for (let i = 0; i < data.length; i += metadata.hasAlpha ? 4 : 3) {
      rgbArray.push(
        data[i],
        data[i + 1],
        data[i + 2],
        metadata.hasAlpha ? data[i + 3] : 255
      );
    }

    // Create TypeScript content with named exports
    const tsContent = `// @generated from ${filename}
// Dimensions: ${width}x${height}
// Format: Linear array of [r,g,b,a] values

export const width = ${width};
export const height = ${height};
export const data = new Uint8Array([${rgbArray.toString()}]);

export default { width, height, data };
`;

    // Write to TS file
    fs.writeFileSync(outputPath, tsContent);
    console.log(`✅ Converted ${filename} to ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(
      `❌ Failed to process ${filename}:`,
      (error as Error).message
    );
  }
}

// Process all PNG files
async function main(): Promise<void> {
  if (pngFiles.length === 0) {
    console.log("No PNG files found in assets directory");
    return;
  }

  console.log(`Found ${pngFiles.length} PNG files in assets directory`);

  // Process each file
  for (const file of pngFiles) {
    await processPngFile(file);
  }

  console.log("Conversion complete!");
}

main().catch((err) => {
  console.error("Conversion failed:", err);
  process.exit(1);
});
