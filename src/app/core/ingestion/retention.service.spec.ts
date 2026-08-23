import { RetentionService } from './retention.service';
import { ArticleEngagementStats } from '../../models/comment.model';

describe('retention', () => {
  const now = Date.parse('2026-08-23T12:00:00Z');
  const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

  const engaged: ArticleEngagementStats = {
    articleId: 'x',
    likes: 1,
    dislikes: 0,
    commentCount: 0,
    totalInteractions: 1,
    score: 2,
  };

  it('does not pin a fresh article even with engagement', () => {
    expect(RetentionService.shouldPin(days(1), engaged, now)).toBeFalse();
  });

  it('deletes an old article with no engagement', () => {
    expect(RetentionService.shouldPin(days(3), undefined, now)).toBeFalse();
  });

  it('pins an old article that has engagement', () => {
    expect(RetentionService.shouldPin(days(3), engaged, now)).toBeTrue();
  });

  it('does not pin engagement past the 7-day hard cap', () => {
    expect(RetentionService.shouldPin(days(8), engaged, now)).toBeFalse();
  });

  it('handles missing/invalid publishedAt', () => {
    expect(RetentionService.shouldPin(undefined, engaged, now)).toBeFalse();
    expect(RetentionService.shouldPin('garbage-date', engaged, now)).toBeFalse();
  });
});
