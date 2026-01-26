import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import { marked } from 'marked';
import type { NotionPageProperties, NotionPost, Author } from '../types';
import type { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

let notionClient: Client | null = null;
let n2mClient: NotionToMarkdown | null = null;

// 이미지 저장 디렉토리
const IMAGE_DIR = 'public/images/notion';

// Notion URL에서 고유 파일 ID 추출 (URL이 바뀌어도 동일)
function getImageId(url: string): string {
  // Notion S3 URL 패턴: .../workspace-id/file-id/filename
  // 예: prod-files-secure.s3.../0fbdabd5-.../fd4d19b7-7ba4-406c-8bdf-2be0579fbf67/...
  const uuidPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi;
  const matches = url.match(uuidPattern);
  
  // 두 번째 UUID가 파일 ID (첫 번째는 workspace ID)
  if (matches && matches.length >= 2) {
    return matches[1].slice(0, 12);
  }
  
  // 패턴 매칭 실패 시 URL 해시 사용
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
  
  // URL에서 확장자 추출 시도
  const urlPath = new URL(url).pathname;
  const match = urlPath.match(/\.(png|jpg|jpeg|gif|webp|svg)/i);
  if (match) return match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  
  return 'png'; // 기본값
}

// Notion 이미지인지 확인
function isNotionImage(url: string): boolean {
  return url.includes('prod-files-secure.s3') || 
         url.includes('s3.us-west-2.amazonaws.com') ||
         url.includes('notion.so');
}

// 이미지 다운로드 및 로컬 경로 반환
async function downloadImage(url: string, slug: string): Promise<string> {
  if (!isNotionImage(url)) {
    return url; // Notion 이미지가 아니면 원본 URL 반환
  }

  try {
    // 디렉토리 생성
    const dir = path.join(process.cwd(), IMAGE_DIR, slug);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const hash = getImageId(url);
    
    // 이미 다운로드된 파일이 있는지 확인
    const existingFiles = fs.readdirSync(dir);
    const existingFile = existingFiles.find(f => f.startsWith(hash));
    if (existingFile) {
      return `/images/notion/${slug}/${existingFile}`;
    }

    // 이미지 다운로드
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to download image: ${url}`);
      return url;
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
    console.error(`Error downloading image: ${url}`, error);
    return url;
  }
}

// HTML 콘텐츠 내의 모든 Notion 이미지를 다운로드하고 경로 교체
async function processContentImages(content: string, slug: string): Promise<string> {
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  const matches = [...content.matchAll(imgRegex)];
  
  let processedContent = content;
  
  for (const match of matches) {
    const originalUrl = match[1];
    if (isNotionImage(originalUrl)) {
      const localPath = await downloadImage(originalUrl, slug);
      processedContent = processedContent.replace(originalUrl, localPath);
    }
  }
  
  return processedContent;
}

function getNotionClient(): Client {
  if (!notionClient) {
    const apiKey = import.meta.env.NOTION_API_KEY;
    if (!apiKey) {
      throw new Error('NOTION_API_KEY is not defined in environment variables');
    }
    notionClient = new Client({ auth: apiKey });
  }
  return notionClient;
}

// 리치 텍스트를 HTML로 변환 (하이라이트 포함)
function richTextToHtml(richText: RichTextItemResponse[]): string {
  return richText.map((text) => {
    let content = text.plain_text;
    const annotations = text.annotations;
    
    // 하이라이트 (배경색)
    if (annotations.color && annotations.color.includes('_background')) {
      const color = annotations.color.replace('_background', '');
      content = `<mark class="highlight-${color}">${content}</mark>`;
    } else if (annotations.color && annotations.color !== 'default') {
      // 텍스트 색상
      content = `<span class="text-${annotations.color}">${content}</span>`;
    }
    
    // 기타 스타일
    if (annotations.bold) content = `<strong>${content}</strong>`;
    if (annotations.italic) content = `<em>${content}</em>`;
    if (annotations.strikethrough) content = `<del>${content}</del>`;
    if (annotations.underline) content = `<u>${content}</u>`;
    if (annotations.code) content = `<code>${content}</code>`;
    
    // 링크
    if (text.type === 'text' && text.text.link) {
      content = `<a href="${text.text.link.url}">${content}</a>`;
    }
    
    return content;
  }).join('');
}

function getN2M(): NotionToMarkdown {
  if (!n2mClient) {
    n2mClient = new NotionToMarkdown({ notionClient: getNotionClient() });
    
    // 텍스트 블록에 하이라이트 보존을 위한 커스텀 transformer
    n2mClient.setCustomTransformer('paragraph', async (block: any) => {
      if (block.paragraph?.rich_text) {
        return richTextToHtml(block.paragraph.rich_text);
      }
      return '';
    });
    
    n2mClient.setCustomTransformer('bulleted_list_item', async (block: any) => {
      if (block.bulleted_list_item?.rich_text) {
        return `- ${richTextToHtml(block.bulleted_list_item.rich_text)}`;
      }
      return '';
    });
    
    n2mClient.setCustomTransformer('numbered_list_item', async (block: any) => {
      if (block.numbered_list_item?.rich_text) {
        return `1. ${richTextToHtml(block.numbered_list_item.rich_text)}`;
      }
      return '';
    });
    
    n2mClient.setCustomTransformer('heading_1', async (block: any) => {
      if (block.heading_1?.rich_text) {
        return `# ${richTextToHtml(block.heading_1.rich_text)}`;
      }
      return '';
    });
    
    n2mClient.setCustomTransformer('heading_2', async (block: any) => {
      if (block.heading_2?.rich_text) {
        return `## ${richTextToHtml(block.heading_2.rich_text)}`;
      }
      return '';
    });
    
    n2mClient.setCustomTransformer('heading_3', async (block: any) => {
      if (block.heading_3?.rich_text) {
        return `### ${richTextToHtml(block.heading_3.rich_text)}`;
      }
      return '';
    });
  }
  return n2mClient;
}

function getDataSourceId(): string {
  const dataSourceId = import.meta.env.NOTION_DATABASE_ID;
  if (!dataSourceId) {
    throw new Error(
      'NOTION_DATABASE_ID is not defined in environment variables',
    );
  }
  return dataSourceId;
}

function getTitle(properties: NotionPageProperties): string {
  return properties.Title?.title?.[0]?.plain_text ?? 'Untitled';
}

function getRichText(
  properties: NotionPageProperties,
  key: keyof NotionPageProperties,
): string {
  const prop = properties[key] as { rich_text?: Array<{ plain_text: string }> };
  return prop?.rich_text?.[0]?.plain_text ?? '';
}

function getCoverUrl(properties: NotionPageProperties): string | null {
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

function getTags(properties: NotionPageProperties): string[] {
  return properties.Tags?.multi_select?.map((tag) => tag.name) ?? [];
}

function getCategory(properties: NotionPageProperties): string | null {
  return properties.Category?.select?.name ?? null;
}

function getAuthor(properties: NotionPageProperties): Author | null {
  const people = properties.Author?.people;
  if (!people || people.length === 0) return null;

  const person = people[0];
  return {
    id: person.id,
    name: person.name,
    avatar: person.avatar_url,
  };
}

function getDate(
  properties: NotionPageProperties,
  key: 'PublishedAt' | 'UpdatedAt',
): Date | null {
  const prop = properties[key] as { date?: { start: string } | null };
  return prop?.date?.start ? new Date(prop.date.start) : null;
}

function getNumber(
  properties: NotionPageProperties,
  key: 'ReadingTime',
): number {
  const prop = properties[key] as { number?: number | null };
  return prop?.number ?? 0;
}

export async function getNotionPosts(): Promise<NotionPost[]> {
  const apiKey = import.meta.env.NOTION_API_KEY;
  const databaseId = import.meta.env.NOTION_DATABASE_ID;

  if (!apiKey || !databaseId) {
    console.warn('Notion credentials not set');
    return [];
  }

  try {
    const notion = getNotionClient();
    const n2m = getN2M();
    const dataSourceId = await getDataSourceId();

    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        property: 'Published',
        checkbox: {
          equals: true,
        },
      },
      sorts: [
        {
          property: 'PublishedAt',
          direction: 'descending',
        },
      ],
    });

    const posts: NotionPost[] = [];

    for (const page of response.results) {
      if (!('properties' in page) || !('created_time' in page)) continue;

      const properties = page.properties as unknown as NotionPageProperties;
      const createdTime = (page as { created_time: string }).created_time;
      const slug = getRichText(properties, 'Slug') || page.id.replace(/-/g, '');

      const mdBlocks = await n2m.pageToMarkdown(page.id);
      const markdown = n2m.toMarkdownString(mdBlocks).parent;
      let content = await marked(markdown);
      
      // 콘텐츠 내 이미지 다운로드 및 경로 교체
      content = await processContentImages(content, slug);

      const publishedAt = getDate(properties, 'PublishedAt');
      const updatedAt = getDate(properties, 'UpdatedAt');
      
      // 커버 이미지 다운로드
      const coverUrl = getCoverUrl(properties);
      const cover = coverUrl ? await downloadImage(coverUrl, slug) : null;

      posts.push({
        id: page.id,
        slug,
        title: getTitle(properties),
        description: getRichText(properties, 'Summary'),
        pubDate: publishedAt || new Date(createdTime),
        updatedDate: updatedAt || undefined,
        tags: getTags(properties),
        category: getCategory(properties),
        cover,
        published: true,
        content: content,
        readingTime: getNumber(properties, 'ReadingTime'),
        author: getAuthor(properties),
      });
    }

    return posts;
  } catch (error) {
    console.error('Error fetching Notion posts:', error);
    return [];
  }
}

export async function getNotionPostBySlug(
  slug: string,
): Promise<NotionPost | null> {
  const posts = await getNotionPosts();
  return posts.find((post) => post.slug === slug) || null;
}

export async function getPostsByTag(tag: string): Promise<NotionPost[]> {
  const posts = await getNotionPosts();
  return posts.filter((post) => post.tags.includes(tag));
}

export async function getAllTags(): Promise<string[]> {
  const posts = await getNotionPosts();
  const tagSet = new Set<string>();
  posts.forEach((post) => {
    post.tags.forEach((t) => tagSet.add(t));
  });
  return Array.from(tagSet).sort();
}

export async function getAllSlugs(): Promise<string[]> {
  const posts = await getNotionPosts();
  return posts.map((post) => post.slug).filter((slug) => slug);
}
