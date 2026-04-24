import { notFound, redirect } from 'next/navigation';
import React from 'react';

import { auth } from '@/auth';
import QuestionForm from '@/components/forms/QuestionForm';
import ROUTES from '@/constants/routes';
import { getQuestion } from '@/lib/actions/question.action';

const EditQuestion = async ({ params }: RouteParams) => {
  const { id } = await params;
  if (!id) return notFound(); // If no id then automatically navigate to 404 page

  const session = await auth();
  if (!session) return redirect('/sign-in');

  const { data: question, success } = await getQuestion({ questionId: id });
  if (!success) return notFound();

  if (question?.author._id.toString() !== session?.user?.id)
    redirect(ROUTES.QUESTION(id)); // If the user is not the author of the question, redirect to the question page
  return (
    <main>
      <QuestionForm question={question} isEdit />
    </main>
  );
};

export default EditQuestion;
