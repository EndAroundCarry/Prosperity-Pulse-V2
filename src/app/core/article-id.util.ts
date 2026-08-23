/**
 * Single source of truth for article document IDs.
 * Used by both NewsService (read) and the ingestion engine (write),
 * plus CommentService for engagement stats joins.
 *
 * IMPORTANT: This must produce the same IDs that were historically
 * written by NewsService.buildArticleDocId — changing the algorithm
 * would orphan all existing comments and reactions.
 */
export interface ArticleIdInput {
  title: string;
  sourceName: string;
  publishedAt: string;
}

export function buildArticleDocId(article: ArticleIdInput): string {
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
  const dateSlug = article.publishedAt
    ? article.publishedAt.slice(0, 10)
    : 'unknown';
  return `${sourceSlug}-${titleSlug}-${dateSlug}`.slice(0, 120);
}
