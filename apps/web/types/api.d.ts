type FastApiAuthResponse = {
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    username?: string | null;
  };
};

type GetQuestionsResponse = {
  questions: Question[];
  isNext: boolean;
};

type GetAnswersResponse = {
  answers: Answer[];
  isNext: boolean;
  totalAnswers: number;
};

type CreateAnswerResponse = {
  _id: string;
  author: { id: string; name: string; image?: string | null };
  question: string;
  content: string;
  upvotes: number;
  downvotes: number;
  createdAt: Date;
};
