import type { APIRoute } from 'astro';
import { getNotionPosts } from '../../lib/notion';

export const GET: APIRoute = async () => {
  const posts = await getNotionPosts();

  const searchData = posts.map((post) => ({
    title: post.title,
    description: post.description,
    slug: post.slug,
  }));

  return new Response(JSON.stringify(searchData), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
