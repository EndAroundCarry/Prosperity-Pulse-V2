/**
 * Daily data retention cleanup.
 *
 * Runs once per day inside the ingest lock, spending zero API calls:
 * - Deletes `news` docs with `publishedAt` older than 2 days, in
 *   writeBatch chunks of 500.
 * - Exception: pins articles that have comments or reactions (up to
 *   7-day hard cap) — deleting actively-discussed articles orphans
 *   comments and is bad product behavior.
 * - Cascade-deletes `comments` and `article_reactions` for deleted
 *   articles so orphans don't accumulate.
 * - `market_series` docs keep ~100 days (bounded array trim).
 */

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  deleteDoc,
  writeBatch,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { ArticleEngagementStats } from '../../models/comment.model';
import { CommentService } from '../../services/comment.service';

const NEWS_RETENTION_DAYS = 2;
const NEWS_HARD_CAP_DAYS = 7;
const MARKET_SERIES_MAX_DAYS = 100;
const BATCH_SIZE = 500;

@Injectable({ providedIn: 'root' })
export class RetentionService {
  private readonly firestore = inject(Firestore);
  private readonly commentService = inject(CommentService);

  /**
   * Run the full retention sweep.  Should be called once per tick
   * cycle (the scheduler decides when — e.g. once per day).
   */
  async runCleanup(): Promise<{ deleted: number; pinned: number }> {
    const newsResult = await this.cleanupNews();
    return newsResult;
  }

  private async cleanupNews(): Promise<{ deleted: number; pinned: number }> {
    const now = Date.now();
    const cutoffMs = now - NEWS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const hardCapMs = now - NEWS_HARD_CAP_DAYS * 24 * 60 * 60 * 1000;
    const cutoffStr = new Date(cutoffMs).toISOString();
    const hardCapStr = new Date(hardCapMs).toISOString();

    // 1. Get engagement stats to identify articles with comments/reactions
    const engagementStats = await firstValueFrom(
      this.commentService.getAllArticleEngagementStats()
    );

    // 2. Fetch all news docs older than the soft cutoff
    const newsRef = collection(this.firestore, 'news');
    const oldNewsQuery = query(
      newsRef,
      where('publishedAt', '<', cutoffStr)
    );
    const oldNewsSnap = await getDocs(oldNewsQuery);

    let deleted = 0;
    let pinned = 0;
    const toDelete: string[] = [];

    for (const docSnap of oldNewsSnap.docs) {
      const data = docSnap.data();
      const publishedAt = data['publishedAt'] as string;
      const pubTime = new Date(publishedAt).getTime();

      // Hard cap: always delete articles older than HARD_CAP_DAYS
      if (pubTime < hardCapMs) {
        toDelete.push(docSnap.id);
        continue;
      }

      // Between soft cutoff and hard cap: pin if has engagement
      const articleId = docSnap.id;
      const stats = engagementStats[articleId];
      const hasEngagement =
        stats &&
        (stats.commentCount > 0 || stats.likes > 0 || stats.dislikes > 0);

      if (hasEngagement) {
        pinned++;
      } else {
        toDelete.push(docSnap.id);
      }
    }

    // 3. Delete in batches of 500
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const batch = writeBatch(this.firestore);
      const chunk = toDelete.slice(i, i + BATCH_SIZE);

      for (const articleId of chunk) {
        // Cascade-delete comments
        const commentsQuery = query(
          collection(this.firestore, 'comments'),
          where('articleId', '==', articleId)
        );
        const commentsSnap = await getDocs(commentsQuery);
        for (const c of commentsSnap.docs) {
          batch.delete(c.ref);
        }

        // Cascade-delete reactions
        try {
          const reactionRef = doc(this.firestore, 'article_reactions', articleId);
          batch.delete(reactionRef);
        } catch {
          // May not exist — ignore
        }

        // Delete the news article itself
        batch.delete(doc(this.firestore, 'news', articleId));
      }

      await batch.commit();
      deleted += chunk.length;
    }

    return { deleted, pinned };
  }
}
