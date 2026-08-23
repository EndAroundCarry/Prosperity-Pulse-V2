import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { buildArticleDocId } from './article-id.util';
import { CommentService } from '../services/comment.service';

describe('article id util', () => {
  const article = {
    title: 'Fed Holds Rates Steady!',
    sourceName: 'Reuters',
    publishedAt: '2026-08-20T14:30:00Z',
  };

  it('produces a deterministic slug-based id', () => {
    const first = buildArticleDocId(article);
    const second = buildArticleDocId(article);
    expect(first).toBe(second);
    expect(first).toContain('reuters');
    expect(first).toContain('fed-holds-rates-steady');
    expect(first).toContain('2026-08-20');
  });

  it('differs when the source changes', () => {
    const other = { ...article, sourceName: 'Bloomberg' };
    expect(buildArticleDocId(article)).not.toBe(buildArticleDocId(other));
  });

  it('caps the id length at 120 characters', () => {
    const longTitle = 'x'.repeat(500);
    const id = buildArticleDocId({ title: longTitle, sourceName: 'a'.repeat(200), publishedAt: '2026-08-20' });
    expect(id.length).toBeLessThanOrEqual(120);
  });

  it('CommentService.getArticleKey delegates to the shared util', () => {
    // CommentService.getArticleKey must produce the same id as the ingest
    // persist handler (buildArticleDocId), or comments silently detach
    // from their articles. Verify the real service delegates.
    TestBed.configureTestingModule({
      providers: [{ provide: Firestore, useValue: {} }],
    });
    const service = TestBed.inject(CommentService);
    expect(service.getArticleKey(article as never)).toBe(buildArticleDocId(article));
  });
});
