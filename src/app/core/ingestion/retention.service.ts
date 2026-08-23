import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { ArticleEngagementStats } from '../../models/comment.model';

export const NEWS_RETENTION_DAYS = 2;
export const NEWS_HARD_CAP_DAYS = 7;
export const BATCH_SIZE = 500;

/**
 * Retention cleanup — runs once per day inside the ingestion lock,
 * spending zero API calls.
 *
 * - Deletes `news` docs with publishedAt older than 2 days, in writeBatch
 *   chunks of 500.
 * - Exception: pins articles that have comments or reactions, up to a
 *   7-day hard cap. Deleting a discussed article orphans its comments.
 * - Cascade-deletes `comments` and `article_reactions` for articles that
 *   are deleted, so orphans don't accumulate.
 */
@Injectable({ providedIn: 'root' })
export class RetentionService {
  private readonly firestore = inject(Firestore);

  /**
   * Pure decision: should this article be retained (pinned) given its
   * published date, engagement stats, and the current time?
   */
  static shouldPin(
    publishedAt: string | null | undefined,
    engagement: ArticleEngagementStats | undefined,
    now: number
  ): boolean {
    if (!publishedAt) return false;
    const ageMs = now - Date.parse(publishedAt);
    if (Number.isNaN(ageMs) || ageMs < 0) return false;

    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    if (ageDays > NEWS_HARD_CAP_DAYS) return false;

    const hasEngagement =
      !!engagement &&
      (engagement.likes > 0 ||
        engagement.dislikes > 0 ||
        engagement.commentCount > 0);

    return ageDays > NEWS_RETENTION_DAYS && hasEngagement;
  }

  /** Run the retention sweep. Returns counts for tests/debug. */
  async run(now = new Date()): Promise<{ deleted: number; pinned: number }> {
    const cutoff = new Date(now.getTime() - NEWS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const stats = await this.loadEngagementStats();
    let deleted = 0;
    let pinned = 0;

    // Fetch candidate articles older than the cutoff.
    const articlesRef = collection(this.firestore, 'news');
    const snap = await getDocs(query(articlesRef, where('publishedAt', '<', cutoff.toISOString())));

    const batch = writeBatch(this.firestore);
    let batchCount = 0;

    for (const articleDoc of snap.docs) {
      const data = articleDoc.data();
      const publishedAt = String(data['publishedAt'] ?? '');
      const engagement = stats[articleDoc.id];

      if (RetentionService.shouldPin(publishedAt, engagement, now.getTime())) {
        pinned++;
        continue;
      }

      // Cascade-delete comments and reactions.
      const commentsSnap = await getDocs(
        query(collection(this.firestore, 'comments'), where('articleId', '==', articleDoc.id))
      );
      commentsSnap.docs.forEach((c) => {
        batch.delete(c.ref);
        batchCount++;
      });

      const reactionsRef = doc(this.firestore, 'article_reactions', articleDoc.id);
      batch.delete(reactionsRef);
      batch.delete(articleDoc.ref);
      batchCount += 2;
      deleted++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        // eslint-disable-next-line no-param-reassign
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return { deleted, pinned };
  }

  private async loadEngagementStats(): Promise<Record<string, ArticleEngagementStats>> {
    const comments$ = collectionData(collection(this.firestore, 'comments'), { idField: 'id' });
    const reactions$ = collectionData(collection(this.firestore, 'article_reactions'), { idField: 'articleId' });

    const [comments, reactions] = await Promise.all([
      firstValueFrom(comments$),
      firstValueFrom(reactions$),
    ]);

    const stats: Record<string, ArticleEngagementStats> = {};
    (reactions as any[]).forEach((r) => {
      const articleId = r.articleId || r.firestoreId || '';
      if (articleId) {
        const likes = typeof r.likes === 'number' ? r.likes : (Array.isArray(r.likedBy) ? r.likedBy.length : 0);
        const dislikes = typeof r.dislikes === 'number' ? r.dislikes : (Array.isArray(r.dislikedBy) ? r.dislikedBy.length : 0);
        stats[articleId] = {
          articleId,
          likes,
          dislikes,
          commentCount: 0,
          totalInteractions: likes + dislikes,
          score: (likes * 2) + dislikes,
        };
      }
    });
    (comments as any[]).forEach((c) => {
      const articleId = c.articleId || '';
      if (articleId) {
        if (!stats[articleId]) {
          stats[articleId] = {
            articleId,
            likes: 0,
            dislikes: 0,
            commentCount: 0,
            totalInteractions: 0,
            score: 0,
          };
        }
        stats[articleId].commentCount += 1;
      }
    });
    return stats;
  }
}
