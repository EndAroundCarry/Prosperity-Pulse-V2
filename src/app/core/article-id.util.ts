/**
 * Deterministic article document id.
 *
 * buildArticleDocId was duplicated verbatim in news.service.ts and
 * CommentService.getArticleKey(). If they ever drift, every comment
 * silently detaches from its article. This is the single source of truth.
 */
export function buildArticleDocId(article: {
  title?: string;
  sourceName?: string;
  publishedAt?: string;
}): string {
  const titleSlug = (article.title || 'article')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const sourceSlug = (article.sourceName || 'source')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const dateSlug = article.publishedAt ? article.publishedAt.slice(0, 10) : 'unknown';
  return `${sourceSlug}-${titleSlug}-${dateSlug}`.slice(0, 120);
}

export function buildTopicDocId(topic: string): string {
  return topic.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'topic';
}
