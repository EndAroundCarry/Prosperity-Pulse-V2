export interface CommentItem {
  id: string;
  articleId: string;
  userId: string;
  userDisplayName: string;
  userPhotoUrl?: string;
  text: string;
  createdAt: string;
  likes: number;
  dislikes: number;
  likedBy: string[];
  dislikedBy: string[];
}

export interface ArticleReaction {
  articleId: string;
  likes: number;
  dislikes: number;
  likedBy: string[];
  dislikedBy: string[];
}

export interface ArticleEngagementStats {
  articleId: string;
  likes: number;
  dislikes: number;
  commentCount: number;
  totalInteractions: number;
  score: number;
}

