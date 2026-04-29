import { getAllPosts } from '@/lib/blog';

export const dynamic = 'force-static';

function escape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const posts = getAllPosts();
  const site = 'https://chemirl.app';
  const feedUpdated = posts[0]?.date ?? new Date();
  const fallbackImage = `${site}/opengraph-image.png`;

  const items = posts
    .map((post) => {
      const url = `${site}/blog/${post.slug}`;
      const imageUrl = post.image ?? fallbackImage;
      return `    <item>
      <title>${escape(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escape(post.excerpt)}</description>
      <pubDate>${post.date.toUTCString()}</pubDate>
      <author>noreply@chemirl.app (${escape(post.authorData.name)})</author>
      <category>${escape(post.category)}</category>
      <enclosure url="${escape(imageUrl)}" type="image/png" length="0" />
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Chem IRL Blog</title>
    <link>${site}/blog</link>
    <atom:link href="${site}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Research, product updates, and safety notes from Chem IRL.</description>
    <language>en-us</language>
    <lastBuildDate>${feedUpdated.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
