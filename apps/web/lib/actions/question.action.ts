'use server';

import mongoose, { QueryFilter, Types } from 'mongoose';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { cache } from 'react';

import { auth } from '@/auth';
import { Answer, Interaction, Vote } from '@/database';
import Collection from '@/database/collection.model';
import Question from '@/database/question.model';
import TagQuestion from '@/database/tag-question.model';
import Tag, { ITagDoc } from '@/database/tag.model';

import action from '../handlers/action';
import handleError from '../handlers/error';
import dbConnect from '../mongoose';
import {
  AskQuestionSchema,
  DeleteQuestionSchema,
  EditQUestionSchema,
  GetQuestionSchema,
  IncrementViewsSchema,
  PaginatedSearchParamsSchema,
} from '../validations';
import { createInteraction } from './interaction.action';
// import User from '@/database/user.model';

export async function createQuestion(
  params: CreateQuestionParams
): Promise<ActionResponse<Question>> {
  const validationResult = await action({
    params,
    schema: AskQuestionSchema,
    authorize: true, // Only authorized users can make a request
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { title, content, tags } = validationResult.params!;
  const userId = validationResult.session?.user?.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [question] = await Question.create(
      [{ title, content, author: userId }],
      {
        session,
      }
    );

    if (!question) throw new Error('Failed to create question');

    const tagIds: mongoose.Types.ObjectId[] = [];
    const tagQuestionDocuments = [];

    for (const tag of tags) {
      const existingTag = await Tag.findOneAndUpdate(
        {
          name: { $regex: new RegExp(`^${tag}$`, 'i') }, // The first parameter is the object for the search criteria
        },
        { $setOnInsert: { name: tag }, $inc: { questions: 1 } }, // If a tag does not exist then we insert a new tag with setOnInsert and then increment the question count by 1
        { upsert: true, new: true, session }
      );
      tagIds.push(existingTag._id);
      tagQuestionDocuments.push({
        tag: existingTag._id,
        question: question._id,
      });
    }

    await TagQuestion.insertMany(tagQuestionDocuments, { session });

    await Question.findByIdAndUpdate(
      question._id,
      { $push: { tags: { $each: tagIds } } },
      { session }
    );

    // Log the interaction
    after(async () => {
      await createInteraction({
        action: 'post',
        actionId: question._id.toString(),
        authorId: userId as string,
        actionTarget: 'question',
      });
    });

    await session.commitTransaction();
    return {
      success: true,
      data: JSON.parse(JSON.stringify(question)),
    };
  } catch (error) {
    await session.abortTransaction();
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}

export async function editQuestion(
  params: EditQuestionParams
): Promise<ActionResponse<Question>> {
  const validationResult = await action({
    params,
    schema: EditQUestionSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { title, content, tags, questionId } = validationResult.params!;
  const userId = validationResult?.session?.user?.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const question = await Question.findById(questionId).populate('tags'); // populate specifies paths which should be populated with other documents

    if (!question) throw new Error('Question not found');
    if (question.author.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    if (question.title !== title || question.content !== content) {
      question.title = title;
      question.content = content;
      await question.save({ session });
    }

    const tagsToAdd = tags.filter(
      (tag) =>
        !question.tags.some((t: ITagDoc) =>
          t.name.toLowerCase().includes(tag.toLowerCase())
        )
    );

    const tagsToRemove = question.tags.filter(
      (tag: ITagDoc) => !tags.includes(tag.name.toLowerCase())
    );

    const newTagDocuments = [];

    if (tagsToAdd.length > 0) {
      for (const tag of tagsToAdd) {
        const existingTag = await Tag.findOneAndUpdate(
          { name: { $regex: `^${tag}$`, $options: 'i' } },
          { $setOnInsert: { name: tag }, $inc: { questions: 1 } },
          { upsert: true, new: true, session }
        );

        if (existingTag) {
          newTagDocuments.push({
            tag: existingTag._id,
            question: questionId,
          });
        }

        question.tags.push(existingTag._id);
      }
    }

    if (tagsToRemove.length > 0) {
      const tagIdsToRemove = tagsToRemove.map((tag: ITagDoc) => tag._id);

      await Tag.updateMany(
        { _id: { $in: tagIdsToRemove } },
        { $inc: { questions: -1 } },
        { session }
      );

      await TagQuestion.deleteMany(
        { tag: { $in: tagIdsToRemove }, question: questionId },
        { session }
      );

      question.tags = question.tags.filter(
        (tag: mongoose.Types.ObjectId) =>
          !tagIdsToRemove.some((id: mongoose.Types.ObjectId) =>
            id.equals(tag._id)
          )
      );
    }

    if (newTagDocuments.length > 0) {
      await TagQuestion.insertMany(newTagDocuments, { session });
    }

    await question.save({ session });

    await session.commitTransaction();

    return { success: true, data: JSON.parse(JSON.stringify(question)) };
  } catch (error) {
    await session.abortTransaction();
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}

export const getQuestion = cache(async function getQuestion(
  params: GetQuestionParams
): Promise<ActionResponse<Question>> {
  const validationResult = await action({
    params,
    schema: GetQuestionSchema,
    // authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params!;

  try {
    const question = await Question.findById(questionId)
      .populate('tags')
      .populate('author', '_id name image');
    if (!question) throw new Error('Question not found');

    return { success: true, data: JSON.parse(JSON.stringify(question)) };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
});

// This server action will only be called when the filter is set to recommended
export async function getRecommendedQuestions({
  userId,
  query,
  skip,
  limit,
}: RecommendationParams) {
  const interactions = await Interaction.find({
    user: new Types.ObjectId(userId), // Converting userId string to a mongodb object ID to ensure it matches the database field type
    actionType: 'question',
    action: { $in: ['view', 'upvote', 'bookmark', 'post'] },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean(); // Lean transforms the object that is returned from the database to javascript friendly objects

  // Find the interacted question id
  const interactedQuestionId = interactions.map(
    (interaction) => interaction.actionId
  );

  const interactedQuestions = await Question.find({
    _id: { $in: interactedQuestionId },
  }).select('tags');

  // console.log('Interacted questions are', interactedQuestions);

  const allTags = interactedQuestions.flatMap((q) =>
    q.tags.map((tag: Types.ObjectId) => tag.toString())
  );

  const uniqueTagIds = [...new Set(allTags)];

  const recommendedQuery: QueryFilter<typeof Question> = {
    _id: { $nin: interactedQuestionId },
    author: { $ne: new Types.ObjectId(userId) },
    tags: { $in: uniqueTagIds.map((id) => new Types.ObjectId(id)) },
  };

  if (query) {
    recommendedQuery.$or = [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } },
    ];
  }

  const total = await Question.countDocuments(recommendedQuery);

  const questions = await Question.find(recommendedQuery)
    .populate('tags', 'name')
    .populate('author', 'name image')
    .sort({ upvotes: -1, views: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    questions: JSON.parse(JSON.stringify(questions)),
    isNext: total > skip + questions.length,
  };

  // console.log('All tags are', allTags);
}

export async function getQuestions(
  params: PaginatedSearchParams
): Promise<ActionResponse<{ questions: Question[]; isNext: boolean }>> {
  const validationResult = await action({
    params,
    schema: PaginatedSearchParamsSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { page = 1, pageSize = 10, query, filter } = params;

  const skip = (Number(page) - 1) * pageSize;
  const limit = Number(pageSize);

  const filterQuery: QueryFilter<typeof Question> = {};

  // TODO: Recommended questions to be done later
  if (filter === 'recommended') {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId)
      return { success: true, data: { questions: [], isNext: false } };
    const recommendedQuestions = await getRecommendedQuestions({
      userId,
      query,
      skip,
      limit,
    });
    return {
      success: true,
      data: recommendedQuestions,
    };
  }

  if (query) {
    filterQuery.$or = [
      { title: { $regex: new RegExp(query, 'i') } },
      { content: { $regex: new RegExp(query, 'i') } },
    ];
  }

  let sortCriteria = {};

  switch (filter) {
    case 'newest':
      sortCriteria = { createdAt: -1 };
      break;
    case 'unanswered':
      filterQuery.answers = 0;
      sortCriteria = { createdAt: -1 };
      break;
    case 'popular':
      sortCriteria = { upvotes: -1 };
      break;
    default:
      sortCriteria = { createdAt: -1 };
      break;
  }

  try {
    const totalQuestions = await Question.countDocuments(filterQuery);
    // const questions = await Question.find();
    const questions = await Question.find(filterQuery)
      .populate('tags', 'name') // Populate the tags field with the name of the tag
      .populate('author', 'name image') // Populate the author field with the name and image of the author
      .lean() // Convert Mongoose documents to plain JavaScript objects
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit);
    // console.log('Questions in server actions are', questions);
    const isNext = totalQuestions > skip + questions.length;

    return {
      success: true,
      data: { questions: JSON.parse(JSON.stringify(questions)), isNext }, // The reason for using JSON.parse and JSON.stringify is to ensure compatibility with Next.js server actions to account for passing large payloads through server actions because some times it may not work as expected
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

export async function incrementViews(
  params: IncrementViewsParams
): Promise<ActionResponse<{ views: number }>> {
  const validationResult = await action({
    params,
    schema: IncrementViewsSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params!;

  try {
    const question = await Question.findById(questionId);

    if (!question) throw new Error('Question not found');

    question.views += 1;

    await question.save();

    return { success: true, data: { views: question.views } };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

export async function getHotQuestions(): Promise<ActionResponse<Question[]>> {
  try {
    await dbConnect();
    const questions = await Question.find()
      .sort({ views: -1, upvotes: -1 })
      .limit(5);
    return {
      success: true,
      data: JSON.parse(JSON.stringify(questions)),
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

export async function deleteQuestion(
  params: DeleteQuestionParams
): Promise<ActionResponse> {
  const validationResult = await action({
    params,
    schema: DeleteQuestionSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params!;
  const { user } = validationResult.session!;

  // Create a new mongoose session
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const question = await Question.findById(questionId).session(session);
    if (!question) throw new Error('Question not found'); // If no question is found in the DB then we need to throw an error
    if (!user) throw new Error('User not found');

    // Check if the user is the author of the question
    if (!question.author.equals(new mongoose.Types.ObjectId(user.id)))
      throw new Error('You are not authorized to delete this question');

    // Delete references from collection
    await Collection.deleteMany({ question: questionId }).session(session);

    // Delete references from TagQuestion Collection
    await TagQuestion.deleteMany({ question: questionId }).session(session);

    // For all tags of the question, find them and reduce their count
    if (question.tags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: question.tags } },
        { $inc: { questions: -1 } },
        { session }
      );
    }

    // Remove all votes of the question
    await Vote.deleteMany({
      actionId: questionId,
      actionType: 'question',
    }).session(session);

    // Remove all answers and their votes of the question
    const answers = await Answer.find({ question: questionId }).session(
      session
    );

    if (answers.length > 0) {
      await Answer.deleteMany({ question: questionId }).session(session);

      await Vote.deleteMany({
        actionId: { $in: answers.map((answer) => answer.id) },
        actionType: 'answer',
      }).session(session);
    }

    // Finally delete the question
    await Question.findByIdAndDelete(questionId).session(session);

    // Commit Transaction
    await session.commitTransaction();
    session.endSession();

    // Revalidate to reflect immediate changes on UI
    revalidatePath(`/profile/${user?.id}`);

    // const deletedCollections = await Collection.deleteMany({ question: question._id });
    // const deletedTagQuestions = await Tag.deleteMany({
    //   question: question._id,
    // });

    // console.log('found saved collection', savedCollections);
    return { success: true };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return handleError(error) as ErrorResponse;
  }
}

// Server actions are designed to be used in different contexts:

// 1. In Server Components: They act like regular async functions
// 2. In Client Components: When used in form actions or event handlers, they are invoked via a POST request.
// It is a direct invocation. When you use a server action in a server component, you are directly calling the function on the server.
// There is no HTTP request involved at all because both the server component and the server actions are executing in the same server environment

/*
Script to delete question from mongodb
// 1. SET THE ID OF THE QUESTION TO DELETE
var qIdStr = '692e755c34bea8e794e4ac6c'; // <--- PASTE ID HERE
var qId = ObjectId(qIdStr);

// 2. FIND THE QUESTION (We need this to get the tags array)
var question = db.questions.findOne({ _id: qId });

if (!question) {
    print("❌ Error: Question not found with ID: " + qIdStr);
} else {
    print("found question: " + question.title);
    
    // --- START CASCADING DELETE ---

    // 3. Delete from 'Collection' (Saved items)
    // Note: Check if your collection name is 'collections' or something else in Atlas
    var delCollections = db.collections.deleteMany({ question: qId });
    print("Deleted saved collections: " + delCollections.deletedCount);

    // 4. Delete references in 'TagQuestion' (if you have a junction table)
    // Note: Check your actual collection name. Mongoose often names it 'tagquestions'.
    var delTagQuestions = db.tagquestions.deleteMany({ question: qId }); 
    print("Deleted TagQuestion links: " + delTagQuestions.deletedCount);

    // 5. Update Tags (Decrease count)
    if (question.tags && question.tags.length > 0) {
        var updateTags = db.tags.updateMany(
            { _id: { $in: question.tags } },
            { $inc: { questions: -1 } }
        );
        print("Updated tags counts: " + updateTags.modifiedCount);
    }

    // 6. Delete Question Votes
    var delQVotes = db.votes.deleteMany({ 
        actionId: qId, 
        actionType: 'question' 
    });
    print("Deleted question votes: " + delQVotes.deletedCount);

    // 7. Handle Answers (Find them first to get IDs, then delete votes, then delete answers)
    var answers = db.answers.find({ question: qId }).toArray();
    var answerIds = answers.map(function(a) { return a._id; });

    if (answerIds.length > 0) {
        // Delete votes for these answers
        var delAVotes = db.votes.deleteMany({
            actionId: { $in: answerIds },
            actionType: 'answer'
        });
        print("Deleted answer votes: " + delAVotes.deletedCount);

        // Delete the answers themselves
        var delAnswers = db.answers.deleteMany({ question: qId });
        print("Deleted answers: " + delAnswers.deletedCount);
    } else {
        print("No answers found for this question.");
    }

    // 8. FINALLY: Delete the Question itself
    var delQuestion = db.questions.deleteOne({ _id: qId });
    print("✅ Successfully deleted question: " + delQuestion.deletedCount);
}
*/
