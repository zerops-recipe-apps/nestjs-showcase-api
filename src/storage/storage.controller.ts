import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { StorageService } from './storage.service';

interface ParsedPart {
  fieldName: string;
  filename?: string;
  contentType: string;
  data: Buffer;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('upload')
  async upload(@Req() req: Request) {
    // Hand-rolled multipart parser — keeps the dependency surface
    // minimal and demonstrates the upload path without pulling in
    // multer just to ship one endpoint.
    const contentType = req.headers['content-type'] || '';
    let file: ParsedPart | null = null;
    let raw: Buffer;
    try {
      raw = await readBody(req, MAX_UPLOAD_BYTES);
    } catch (err) {
      throw new BadRequestException(
        `Upload body read failed: ${(err as Error).message}`,
      );
    }
    if (contentType.startsWith('multipart/form-data')) {
      const boundary = extractBoundary(contentType);
      if (!boundary) throw new BadRequestException('Multipart boundary missing');
      const parts = parseMultipart(raw, boundary);
      file = parts.find((p) => p.filename || p.fieldName === 'file') ?? null;
    } else {
      // Raw-body upload — the SPA blob-fallback button + curl smoke
      // path both POST application/octet-stream here.
      file = {
        fieldName: 'file',
        filename:
          (typeof req.headers['x-filename'] === 'string'
            ? (req.headers['x-filename'] as string)
            : '') || `upload-${Date.now()}.bin`,
        contentType: contentType || 'application/octet-stream',
        data: raw,
      };
    }
    if (!file || file.data.length === 0) {
      throw new BadRequestException('No file content in upload body');
    }
    const safeName = (file.filename || `upload-${Date.now()}.bin`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);
    const key = `uploads/${Date.now()}-${safeName}`;
    const result = await this.storage.put(key, file.data, file.contentType);
    const count = await this.storage.count();
    return { object: result, count };
  }

  @Get('state')
  async state() {
    const [count, recent] = await Promise.all([
      this.storage.count(),
      this.storage.list(5),
    ]);
    return { count, recent };
  }
}

function readBody(req: Request, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error(`Body exceeds ${maxBytes} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function extractBoundary(contentType: string): string | null {
  const match = /boundary=("?)([^";]+)\1/i.exec(contentType);
  return match ? match[2] : null;
}

function parseMultipart(buffer: Buffer, boundary: string): ParsedPart[] {
  const delimiter = Buffer.from(`--${boundary}`);
  const closing = Buffer.from(`--${boundary}--`);
  const parts: ParsedPart[] = [];
  let cursor = 0;
  // Skip past first delimiter
  const first = buffer.indexOf(delimiter, cursor);
  if (first === -1) return parts;
  cursor = first + delimiter.length;
  while (cursor < buffer.length) {
    if (buffer[cursor] === 0x2d && buffer[cursor + 1] === 0x2d) {
      // -- closing
      break;
    }
    // CRLF after delimiter
    if (buffer[cursor] === 0x0d && buffer[cursor + 1] === 0x0a) cursor += 2;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd === -1) break;
    const headerBlock = buffer.slice(cursor, headerEnd).toString('utf8');
    const next = buffer.indexOf(delimiter, headerEnd + 4);
    if (next === -1) break;
    const bodyEnd = next - 2; // trim \r\n
    const data = buffer.slice(headerEnd + 4, bodyEnd);
    const part = headerBlockToPart(headerBlock, data);
    if (part) parts.push(part);
    cursor = next + delimiter.length;
    if (buffer.compare(closing, 0, closing.length, cursor - delimiter.length, cursor - delimiter.length + closing.length) === 0) {
      break;
    }
  }
  return parts;
}

function headerBlockToPart(headerBlock: string, data: Buffer): ParsedPart | null {
  const lines = headerBlock.split(/\r\n/);
  let fieldName = '';
  let filename: string | undefined;
  let contentType = 'application/octet-stream';
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const name = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (name === 'content-disposition') {
      const nameMatch = /name="([^"]+)"/.exec(value);
      if (nameMatch) fieldName = nameMatch[1];
      const filenameMatch = /filename="([^"]*)"/.exec(value);
      if (filenameMatch) filename = filenameMatch[1];
    } else if (name === 'content-type') {
      contentType = value;
    }
  }
  if (!fieldName) return null;
  return { fieldName, filename, contentType, data };
}
