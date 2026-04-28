import Image from 'next/image';
import Link from 'next/link';
import type { Author } from '@/lib/blog/schema';

export function AuthorCard({ author }: { author: Author }) {
  return (
    <div className="flex items-start gap-4 p-6 rounded-brand bg-warm-bg shadow-subtle">
      {author.avatar ? (
        <Image
          src={author.avatar}
          alt={author.name}
          width={56}
          height={56}
          className="rounded-full flex-shrink-0"
          unoptimized
        />
      ) : (
        <div className="w-14 h-14 rounded-full bg-aqua-100 flex items-center justify-center text-aqua-700 font-bold flex-shrink-0">
          {author.name.charAt(0)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <Link
          href={`/blog/author/${author.key}`}
          className="font-semibold text-ink-900 hover:text-aqua-700 transition-colors"
        >
          {author.name}
        </Link>
        {author.role && <div className="text-sm text-ink-500">{author.role}</div>}
        {author.bio && <p className="mt-2 text-sm text-ink-700 leading-relaxed">{author.bio}</p>}
      </div>
    </div>
  );
}
