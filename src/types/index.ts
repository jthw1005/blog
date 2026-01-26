// Notion page properties type (based on your Notion database schema)
export interface NotionPageProperties {
  Title?: {
    title?: Array<{ plain_text: string }>;
  };
  Slug?: {
    rich_text?: Array<{ plain_text: string }>;
  };
  Summary?: {
    rich_text?: Array<{ plain_text: string }>;
  };
  Cover?: {
    files?: Array<{
      type: 'file' | 'external';
      file?: { url: string };
      external?: { url: string };
    }>;
  };
  Tags?: {
    multi_select?: Array<{ name: string }>;
  };
  Category?: {
    select?: { name: string } | null;
  };
  Published?: {
    checkbox?: boolean;
  };
  PublishedAt?: {
    date?: { start: string } | null;
  };
  UpdatedAt?: {
    date?: { start: string } | null;
  };
  ReadingTime?: {
    number?: number | null;
  };
  Author?: {
    people?: Array<{
      id: string;
      name: string;
      avatar_url: string | null;
    }>;
  };
}

export interface Author {
  id: string;
  name: string;
  avatar: string | null;
}

// Post interface for internal use (matches what components expect)
export interface NotionPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  tags: string[];
  category: string | null;
  cover: string | null;
  published: boolean;
  content: string;
  readingTime: number;
  author: Author | null;
}

// Post list item (without content, for listing pages)
export interface PostListItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  cover: string | null;
  tags: string[];
  category: string | null;
  publishedAt: string | null;
  readingTime: number;
}

// Full post (with content)
export interface Post extends PostListItem {
  content: string;
  author: Author | null;
  published: boolean;
  updatedAt: string | null;
}
