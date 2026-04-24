'use server';

import mongoose, { Mongoose } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import ROUTES from '@/constants/routes';
import { Question, Vote } from '@/database';
import Answer, { IAnswerDoc } from '@/database/answer.model';

import action from '../handlers/action';
import handleError from '../handlers/error';
import { UnauthorizedError } from '../http-errors';
import {
  AnswerServerSchema,
  DeleteAnswerSchema,
  GetAnswersSchema,
} from '../validations';
import { createInteraction } from './interaction.action';

export async function createAnswer(
  params: CreateAnswerParams
): Promise<ActionResponse<IAnswerDoc>> {
  const validationResult = await action({
    params,
    schema: AnswerServerSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { content, questionId } = validationResult.params!;

  const userId = validationResult?.session?.user?.id;

  //   Starting a mongoose session for atomic action
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const question = await Question.findById(questionId);
    if (!question) throw new Error('Question not found');

    // We destructure the response [answer]. If we wanna track this transaction with a session, we need to pass an array as the first param
    // even if it is just a single document and the second parameter is a session so that we can stop if something goes wrong
    const [newAnswer] = await Answer.create(
      [
        {
          author: userId,
          question: questionId,
          content,
        },
      ],
      { session }
    );

    if (!newAnswer) throw new Error('Failed to create answer');

    question.answers += 1;
    await question.save({ session });

    after(async () => {
      await createInteraction({
        action: 'post',
        actionId: newAnswer._id.toString(),
        authorId: userId as string,
        actionTarget: 'answer',
      });
    });

    await session.commitTransaction();

    revalidatePath(ROUTES.QUESTION(questionId));

    return { success: true, data: JSON.parse(JSON.stringify(newAnswer)) };
  } catch (error) {
    await session.abortTransaction();
    return handleError(error) as ErrorResponse;
  } finally {
    session.endSession();
  }
}

export async function getAnswers(
  params: GetAnswersParams
): Promise<
  ActionResponse<{ answers: Answer[]; isNext: boolean; totalAnswers: number }>
> {
  const validationResult = await action({
    params,
    schema: GetAnswersSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId, page = 1, pageSize = 10, filter } = params;

  const skip = (Number(page) - 1) * pageSize;
  const limit = pageSize;

  let sortCriteria = {};

  switch (filter) {
    case 'latest':
      sortCriteria = { createdAt: -1 };
      break;
    case 'oldest':
      sortCriteria = { createdAt: 1 };
      break;
    case 'popular':
      sortCriteria = { upvotes: -1 };
      break;
    default:
      sortCriteria = { createdAt: -1 };
      break;
  }

  try {
    const totalAnswers = await Answer.countDocuments({ question: questionId });

    const answers = await Answer.find({ question: questionId })
      .populate('author', '_id name image')
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit);

    const isNext = totalAnswers > answers.length + skip;

    return {
      success: true,
      data: {
        answers: JSON.parse(JSON.stringify(answers)),
        isNext,
        totalAnswers,
      },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

export async function deleteAnswer(
  params: DeleteAnswerParams
): Promise<ActionResponse<null>> {
  const validationResult = await action({
    params,
    schema: DeleteAnswerSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { answerId } = validationResult.params!;
  const { user } = validationResult.session!;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const answer = await Answer.findById(answerId).session(session);
    if (!answer) throw new Error('Answer not found');
    if (!user) throw new Error('User not found');

    if (answer.author.toString() !== user.id) {
      throw new UnauthorizedError(
        'You are not authorized to delete the answer'
      );
    }

    // Reduce the question answer count
    await Question.findByIdAndUpdate(
      answer.question,
      { $inc: { answers: -1 } },
      { new: true }
    );

    // Delete votes associated with the answer
    await Vote.deleteMany({ actionId: answerId, actionType: 'answer' });

    // Delete the answer
    await Answer.findByIdAndDelete(answerId);
    await session.commitTransaction();
    session.endSession();

    revalidatePath(`/profile/${user?.id}`);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return handleError(error) as ErrorResponse;
  }
  return { success: true };
}
