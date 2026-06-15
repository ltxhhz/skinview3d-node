import { FontLibrary } from 'skia-canvas';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

FontLibrary.use([join(__dirname, '../assets/minecraft.woff2')]);

export * from './model.js';
export * from './viewer.js';
export * from './animation.js';
export * from './nametag.js';
