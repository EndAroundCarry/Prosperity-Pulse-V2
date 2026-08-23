import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from '@angular/fire/firestore';
import { Observable, combineLatest, map, of, catchError } from 'rxjs';
import { CommentItem, ArticleReaction, ArticleEngagementStats } from '../models/comment.model';
import { NewsArticle } from '../models/news-article.model';
import { buildArticleDocId } from '../core/article-id.util';

@Injectable({
  providedIn: 'root',
})
export class CommentService {
  private readonly firestore = inject(Firestore);

  /**
   * Observe engagement stats (likes, dislikes, comments, total interactions) for all articles in real-time.
   */
  getAllArticleEngagementStats(): Observable<Record<string, ArticleEngagementStats>> {
    const comments$ = collectionData(collection(this.firestore, 'comments'), { idField: 'id' }).pipe(
      catchError(() => of([]))
    );
    const reactions$ = collectionData(collection(this.firestore, 'article_reactions'), { idField: 'articleId' }).pipe(
      catchError(() => of([]))
    );

    return combineLatest([comments$, reactions$]).pipe(
      map(([comments, reactions]: [any[], any[]]) => {
        const statsMap: Record<string, ArticleEngagementStats> = {};

        // Process reactions
        reactions.forEach((r) => {
          const articleId = r.articleId || r.firestoreId || '';
          if (articleId) {
            const likes = typeof r.likes === 'number' ? r.likes : (Array.isArray(r.likedBy) ? r.likedBy.length : 0);
            const dislikes = typeof r.dislikes === 'number' ? r.dislikes : (Array.isArray(r.dislikedBy) ? r.dislikedBy.length : 0);
            statsMap[articleId] = {
              articleId,
              likes,
              dislikes,
              commentCount: 0,
              totalInteractions: likes + dislikes,
              score: (likes * 2) + dislikes,
            };
          }
        });

        // Process comments
        comments.forEach((c) => {
          const articleId = c.articleId || '';
          if (articleId) {
            if (!statsMap[articleId]) {
              statsMap[articleId] = {
                articleId,
                likes: 0,
                dislikes: 0,
                commentCount: 0,
                totalInteractions: 0,
                score: 0,
              };
            }
            statsMap[articleId].commentCount += 1;
          }
        });

        // Recalculate totals and weighted score
        Object.values(statsMap).forEach((st) => {
          st.totalInteractions = st.likes + st.dislikes + st.commentCount;
          st.score = (st.likes * 2) + st.dislikes + (st.commentCount * 3);
        });

        return statsMap;
      })
    );
  }

  /**
   * Generates a deterministic unique key for an article based on source, title, and published date.
   */
  getArticleKey(article: NewsArticle): string {
    return buildArticleDocId(article);
  }

  /**
   * Get all comments for an article in real-time from the Firestore comments collection.
   */
  getComments(articleId: string): Observable<CommentItem[]> {
    if (!articleId) return of([]);

    const commentsRef = collection(this.firestore, 'comments');
    const q = query(
      commentsRef,
      where('articleId', '==', articleId)
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((docs: any[]) => {
        const items = docs.map((d) => ({
          id: d.id || d.firestoreId || self.crypto.randomUUID(),
          articleId: d.articleId || articleId,
          userId: d.userId || 'anonymous',
          userDisplayName: d.userDisplayName || 'Anonymous Reader',
          userPhotoUrl: d.userPhotoUrl || '',
          text: d.text || '',
          createdAt: d.createdAt || new Date().toISOString(),
          likes: typeof d.likes === 'number' ? d.likes : (Array.isArray(d.likedBy) ? d.likedBy.length : 0),
          dislikes: typeof d.dislikes === 'number' ? d.dislikes : (Array.isArray(d.dislikedBy) ? d.dislikedBy.length : 0),
          likedBy: Array.isArray(d.likedBy) ? d.likedBy : [],
          dislikedBy: Array.isArray(d.dislikedBy) ? d.dislikedBy : [],
        })) as CommentItem[];

        // Sort descending by createdAt
        return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      })
    );
  }

  /**
   * Add a new comment to Firestore 'comments' collection tied to user and article.
   */
  async addComment(
    articleId: string,
    text: string,
    user: { uid?: string; email?: string | null; displayName?: string | null; photoURL?: string | null }
  ): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || !articleId) return;

    const commentId = self.crypto.randomUUID();
    const commentRef = doc(this.firestore, 'comments', commentId);

    const userId = user.email ?? user.uid ?? 'guest-user';
    const userDisplayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Prosperity Reader');
    const userPhotoUrl = user.photoURL || '';

    const newComment: CommentItem = {
      id: commentId,
      articleId,
      userId,
      userDisplayName,
      userPhotoUrl,
      text: trimmed,
      createdAt: new Date().toISOString(),
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
    };

    await setDoc(commentRef, newComment);
  }

  /**
   * Toggle like or dislike reaction on a specific comment in Firestore.
   */
  async toggleCommentReaction(
    commentId: string,
    reaction: 'like' | 'dislike',
    userId: string
  ): Promise<void> {
    if (!commentId || !userId) return;

    const commentRef = doc(this.firestore, 'comments', commentId);
    const snap = await getDoc(commentRef);
    if (!snap.exists()) return;

    const data = snap.data();
    let likedBy: string[] = Array.isArray(data['likedBy']) ? [...data['likedBy']] : [];
    let dislikedBy: string[] = Array.isArray(data['dislikedBy']) ? [...data['dislikedBy']] : [];

    const isLiked = likedBy.includes(userId);
    const isDisliked = dislikedBy.includes(userId);

    if (reaction === 'like') {
      if (isLiked) {
        // Remove like
        likedBy = likedBy.filter((id) => id !== userId);
      } else {
        // Add like, remove dislike if present
        likedBy.push(userId);
        dislikedBy = dislikedBy.filter((id) => id !== userId);
      }
    } else if (reaction === 'dislike') {
      if (isDisliked) {
        // Remove dislike
        dislikedBy = dislikedBy.filter((id) => id !== userId);
      } else {
        // Add dislike, remove like if present
        dislikedBy.push(userId);
        likedBy = likedBy.filter((id) => id !== userId);
      }
    }

    await updateDoc(commentRef, {
      likedBy,
      dislikedBy,
      likes: likedBy.length,
      dislikes: dislikedBy.length,
    });
  }

  /**
   * Get reactions (likes/dislikes) for an article in real-time.
   */
  getArticleReactions(articleId: string): Observable<ArticleReaction | null> {
    if (!articleId) return of(null);

    const docRef = doc(this.firestore, 'article_reactions', articleId);
    return docData(docRef).pipe(
      map((d: any) => {
        if (!d) return null;
        return {
          articleId,
          likes: typeof d.likes === 'number' ? d.likes : (Array.isArray(d.likedBy) ? d.likedBy.length : 0),
          dislikes: typeof d.dislikes === 'number' ? d.dislikes : (Array.isArray(d.dislikedBy) ? d.dislikedBy.length : 0),
          likedBy: Array.isArray(d.likedBy) ? d.likedBy : [],
          dislikedBy: Array.isArray(d.dislikedBy) ? d.dislikedBy : [],
        } as ArticleReaction;
      })
    );
  }

  /**
   * Toggle like or dislike reaction on an article in Firestore.
   */
  async toggleArticleReaction(
    articleId: string,
    reaction: 'like' | 'dislike',
    userId: string
  ): Promise<void> {
    if (!articleId || !userId) return;

    const docRef = doc(this.firestore, 'article_reactions', articleId);
    const snap = await getDoc(docRef);

    let likedBy: string[] = [];
    let dislikedBy: string[] = [];

    if (snap.exists()) {
      const data = snap.data();
      likedBy = Array.isArray(data['likedBy']) ? [...data['likedBy']] : [];
      dislikedBy = Array.isArray(data['dislikedBy']) ? [...data['dislikedBy']] : [];
    }

    const isLiked = likedBy.includes(userId);
    const isDisliked = dislikedBy.includes(userId);

    if (reaction === 'like') {
      if (isLiked) {
        likedBy = likedBy.filter((id) => id !== userId);
      } else {
        likedBy.push(userId);
        dislikedBy = dislikedBy.filter((id) => id !== userId);
      }
    } else if (reaction === 'dislike') {
      if (isDisliked) {
        dislikedBy = dislikedBy.filter((id) => id !== userId);
      } else {
        dislikedBy.push(userId);
        likedBy = likedBy.filter((id) => id !== userId);
      }
    }

    await setDoc(docRef, {
      articleId,
      likedBy,
      dislikedBy,
      likes: likedBy.length,
      dislikes: dislikedBy.length,
    });
  }
}
