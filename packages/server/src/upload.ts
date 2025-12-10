/**
 * Image upload handler with sharp conversion to WebP
 */

import { IncomingMessage } from 'http';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

export interface UploadResult {
  success: boolean;
  url?: string;
  filename?: string;
  error?: string;
}

export class ImageUploadHandler {
  private uploadDir: string;

  constructor(baseDir: string) {
    this.uploadDir = join(baseDir, 'uploads');
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      // Ignore if already exists
    }
  }

  async handleUpload(req: IncomingMessage): Promise<UploadResult> {
    await this.ensureUploadDir();

    // Collect chunks
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    // Generate filename
    const timestamp = Date.now();
    const filename = `image-${timestamp}.webp`;
    const filepath = join(this.uploadDir, filename);

    try {
      // Convert to WebP using sharp
      await sharp(buffer)
        .webp({
          quality: 80, // Default quality
        })
        .resize(2000, 2000, {
          // Max dimensions
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toFile(filepath);

      return {
        success: true,
        url: `/uploads/${filename}`,
        filename,
      };
    } catch (error) {
      console.error('Image processing error:', error);
      return {
        success: false,
        error: 'Failed to process image',
      };
    }
  }
}
