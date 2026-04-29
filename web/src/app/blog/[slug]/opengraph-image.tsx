import { ImageResponse } from 'next/og';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { getCategoryLabel } from '@/lib/blog/categories';

export const alt = 'Chem IRL blog post';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

const AQUA = '#0A7F74';
const AQUA_LIGHT = '#0B9A8D';
const WARM_BG = '#FFFBF7';
const INK_900 = '#0F172A';
const INK_500 = '#64748B';

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  const title = post?.title ?? 'Chem IRL Blog';
  const author = post?.authorData.name ?? 'Chem IRL';
  const categoryLabel = post ? getCategoryLabel(post.category) : '';
  const titleSize = title.length > 70 ? 56 : title.length > 45 ? 64 : 76;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: WARM_BG,
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 56,
              height: 56,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${AQUA} 0%, ${AQUA_LIGHT} 100%)`,
            }}
          />
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: INK_900,
              letterSpacing: -0.5,
            }}
          >
            Chem IRL
          </div>
        </div>

        {categoryLabel ? (
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '8px 20px',
              border: `2px solid ${AQUA}`,
              borderRadius: 999,
              color: AQUA,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 0.5,
              marginBottom: 28,
            }}
          >
            {categoryLabel}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            fontSize: titleSize,
            fontWeight: 700,
            color: INK_900,
            lineHeight: 1.1,
            letterSpacing: -1.5,
            maxWidth: 1040,
          }}
        >
          {title}
        </div>

        <div style={{ display: 'flex', flexGrow: 1 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 20, color: INK_500, marginBottom: 4 }}>
              By
            </div>
            <div style={{ fontSize: 30, color: INK_900, fontWeight: 600 }}>
              {author}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              color: AQUA,
              fontWeight: 600,
            }}
          >
            chemirl.app
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
