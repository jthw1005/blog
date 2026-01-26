/**
 * Notion 이미지 다운로드 스크립트
 * 빌드 전에 실행하여 모든 이미지를 미리 다운로드합니다.
 */

import { Client } from '@notionhq/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const IMAGE_DIR = 'public/images/notion';

// .env 파일 로드 (로컬 개발용)
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;
      
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = trimmedLine.slice(0, equalIndex).trim();
      let value = trimmedLine.slice(equalIndex + 1).trim();
      
      // 따옴표 제거
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

// 환경 변수 로드
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
  console.log('Notion credentials not set, skipping image download');
  process.exit(0);
}

const notion = new Client({ auth: NOTION_API_KEY });

// Notion URL에서 고유 파일 ID 추출
function getImageId(url: string): string {
  const uuidPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi;
  const matches = url.match(uuidPattern);
  
  if (matches && matches.length >= 2) {
    return matches[1].slice(0, 12);
  }
  
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
}

// 이미지 확장자 추출
function getImageExtension(url: string, contentType?: string): string {
  if (contentType) {
    const ext = contentType.split('/')[1];
    if (ext && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  }
  
  const urlPath = new URL(url).pathname;
  const match = urlPath.match(/\.(png|jpg|jpeg|gif|webp|svg)/i);
  if (match) return match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  
  return 'png';
}

// Notion 이미지인지 확인
function isNotionImage(url: string): boolean {
  return url.includes('prod-files-secure.s3') || 
         url.includes('s3.us-west-2.amazonaws.com') ||
         url.includes('notion.so');
}

// 이미지 다운로드
async function downloadImage(url: string, slug: string): Promise<string | null> {
  if (!isNotionImage(url)) return null;

  try {
    const dir = path.join(process.cwd(), IMAGE_DIR, slug);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const hash = getImageId(url);
    
    // 이미 다운로드된 파일 확인
    const existingFiles = fs.readdirSync(dir);
    const existingFile = existingFiles.find(f => f.startsWith(hash));
    if (existingFile) {
      console.log(`Skipped (exists): ${existingFile}`);
      return `/images/notion/${slug}/${existingFile}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to download: ${url}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const ext = getImageExtension(url, contentType);
    const filename = `${hash}.${ext}`;
    const filepath = path.join(dir, filename);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    console.log(`Downloaded: ${filename}`);
    return `/images/notion/${slug}/${filename}`;
  } catch (error) {
    console.error(`Error downloading: ${url}`, error);
    return null;
  }
}

// 페이지 속성에서 커버 URL 추출
function getCoverUrl(properties: any): string | null {
  const files = properties.Cover?.files;
  if (!files || files.length === 0) return null;

  const file = files[0];
  if (file.type === 'file') {
    return file.file?.url ?? null;
  } else if (file.type === 'external') {
    return file.external?.url ?? null;
  }
  return null;
}

// 페이지 속성에서 Slug 추출
function getSlug(properties: any, pageId: string): string {
  const slugProp = properties.Slug as { rich_text?: Array<{ plain_text: string }> };
  return slugProp?.rich_text?.[0]?.plain_text || pageId.replace(/-/g, '');
}

// 블록에서 이미지 URL 추출
async function getBlockImages(pageId: string): Promise<string[]> {
  const urls: string[] = [];
  
  try {
    let cursor: string | undefined;
    
    do {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
      });
      
      for (const block of response.results) {
        if ('type' in block && block.type === 'image') {
          const imageBlock = block as any;
          if (imageBlock.image?.type === 'file') {
            urls.push(imageBlock.image.file.url);
          } else if (imageBlock.image?.type === 'external') {
            urls.push(imageBlock.image.external.url);
          }
        }
      }
      
      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);
  } catch (error) {
    console.error(`Error fetching blocks for ${pageId}:`, error);
  }
  
  return urls;
}

async function main() {
  console.log('🖼️  Starting Notion image download...\n');

  try {
    // Published 포스트 조회
    const response = await (notion as any).dataSources.query({
      data_source_id: NOTION_DATABASE_ID,
      filter: {
        property: 'Published',
        checkbox: { equals: true },
      },
    });

    console.log(`Found ${response.results.length} published posts\n`);

    for (const page of response.results) {
      if (!('properties' in page)) continue;
      
      const properties = page.properties as any;
      const slug = getSlug(properties, page.id);
      const title = properties.Title?.title?.[0]?.plain_text || 'Untitled';
      
      console.log(`\n📝 ${title} (${slug})`);

      // 커버 이미지 다운로드
      const coverUrl = getCoverUrl(properties);
      if (coverUrl) {
        await downloadImage(coverUrl, slug);
      }

      // 본문 이미지 다운로드
      const blockImages = await getBlockImages(page.id);
      for (const imageUrl of blockImages) {
        await downloadImage(imageUrl, slug);
      }
    }

    console.log('\n✅ Image download complete!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
