import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getNotionPosts } from '../lib/notion';

export async function GET(context: APIContext) {
  const posts = await getNotionPosts();

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site || 'https://juntae-weblog.netlify.app/',
    items: posts.map((post) => ({
      title: post.title,
      description: post.description,
      pubDate: post.pubDate,
      link: `/blog/${post.slug}/`,
    })),
  });
}
