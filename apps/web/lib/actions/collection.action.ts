'use server';

import mongoose, { PipelineStage } from 'mongoose';
import { revalidatePath } from 'next/cache';

import ROUTES from '@/constants/routes';
import { Collection, Question } from '@/database';

import action from '../handlers/action';
import handleError from '../handlers/error';
import {
  CollectionBaseSchema,
  PaginatedSearchParamsSchema,
} from '../validations';

export async function toggleSaveQuestion(
  params: CollectionBaseParams
): Promise<ActionResponse<{ saved: boolean }>> {
  const validationResult = await action({
    params,
    schema: CollectionBaseSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params!;

  const userId = validationResult.session?.user?.id;

  try {
    // Fetch the question that we want to save
    const question = await Question.findById(questionId);

    if (!question) throw new Error('Question not found');

    // Now we create a new collection
    // First we check if the collection already exists
    const collection = await Collection.findOne({
      question: questionId,
      author: userId,
    });

    if (collection) {
      // Remove from the collection
      await Collection.findByIdAndDelete(collection._id);
      revalidatePath(ROUTES.QUESTION(questionId));
      return {
        success: true,
        data: {
          saved: false,
        },
      };
    } else {
      await Collection.create({
        author: userId,
        question: questionId,
      });

      revalidatePath(ROUTES.QUESTION(questionId));
      return {
        success: true,
        data: {
          saved: true,
        },
      };
    }
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

export async function hasSavedQuestion(
  params: CollectionBaseParams
): Promise<ActionResponse<{ saved: boolean }>> {
  const validationResult = await action({
    params,
    schema: CollectionBaseSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { questionId } = validationResult.params!;

  const userId = validationResult.session?.user?.id;

  try {
    // First we check if the collection already exists
    const collection = await Collection.findOne({
      question: questionId,
      author: userId,
    });

    return {
      success: true,
      data: {
        saved: !!collection, // Notation used to transform something into a boolean variable eg: !!falsy -> true -> !true -> false
      },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

export async function getSavedQuestions(
  params: PaginatedSearchParams
): Promise<ActionResponse<{ collection: Collection[]; isNext: boolean }>> {
  const validationResult = await action({
    params,
    schema: PaginatedSearchParamsSchema,
    authorize: true,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const userId = validationResult.session?.user?.id;
  const { page = 1, pageSize = 10, query, filter } = params;

  const skip = (Number(page) - 1) * pageSize;
  const limit = pageSize;

  const sortOptions: Record<string, Record<string, 1 | -1>> = {
    mostrecent: { 'question.createdAt': -1 },
    oldest: { 'question.createdAt': 1 },
    mostvoted: { 'question.upvotes': -1 },
    mostviewed: { 'question.views': -1 },
    mostanswered: { 'question.answers': -1 },
  };

  const sortCriteria = sortOptions[filter as keyof typeof sortOptions] || {
    'question.createdAt': -1,
  };

  try {
    const pipeline: PipelineStage[] = [
      { $match: { author: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'questions',
          localField: 'question',
          foreignField: '_id',
          as: 'question',
        },
      },
      { $unwind: '$question' },
      {
        $lookup: {
          from: 'users',
          localField: 'question.author',
          foreignField: '_id',
          as: 'question.author',
        },
      },
      { $unwind: '$question.author' },
      {
        $lookup: {
          from: 'tags',
          localField: 'question.tags',
          foreignField: '_id',
          as: 'question.tags',
        },
      },
    ];

    if (query) {
      pipeline.push({
        $match: {
          $or: [
            { 'question.title': { $regex: query, $options: 'i' } },
            { 'question.content': { $regex: query, $options: 'i' } },
          ],
        },
      });
    }

    const [totalCount] = await Collection.aggregate([
      ...pipeline,
      { $count: 'count' },
    ]);

    pipeline.push({ $sort: sortCriteria }, { $skip: skip }, { $limit: limit });
    pipeline.push({ $project: { question: 1, author: 1 } });

    const questions = await Collection.aggregate(pipeline);

    const isNext = totalCount.count > skip + questions.length;

    return {
      success: true,
      data: {
        collection: JSON.parse(JSON.stringify(questions)),
        isNext,
      },
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}

// export async function getSavedQuestions(
//   params: PaginatedSearchParams
// ): Promise<ActionResponse<{ collection: Collection[]; isNext: boolean }>> {
//   const validationResult = await action({
//     params,
//     schema: PaginatedSearchParamsSchema,
//     authorize: true,
//   });

//   if (validationResult instanceof Error) {
//     return handleError(validationResult) as ErrorResponse;
//   }

//   const userId = validationResult.session?.user?.id;
//   const { page = 1, pageSize = 10, query, filter } = params;
//   const skip = (Number(page) - 1) * pageSize;
//   const limit = Number(pageSize);

//   const filterQuery: FilterQuery<typeof Collection> = { author: userId };

//   if (query) {
//     filterQuery.$or = [
//       { title: { $regex: new RegExp(query, 'i') } },
//       { content: { $regex: new RegExp(query, 'i') } },
//     ];
//   }

//   let sortCriteria = {};

//   switch (filter) {
//     case 'mostrecent':
//       sortCriteria = { createdAt: -1 };
//       break;
//     case 'oldest':
//       sortCriteria = { createdAt: -1 };
//       break;
//     case 'mostvoted':
//       sortCriteria = { upvotes: -1 };
//       break;
//     case 'mostanswered':
//       sortCriteria = { answers: -1 };
//       break;
//     default:
//       sortCriteria = { createdAt: -1 };
//       break;
//   }

//   try {
//     const totalQuestions = await Question.countDocuments(filterQuery);

//     const questions = await Collection.find(filterQuery)
//       .populate({
//         path: 'question',
//         populate: [
//           { path: 'tags', select: '_id name' },
//           { path: 'author', select: '_id name image' },
//         ],
//       })
//       .sort(sortCriteria)
//       .skip(skip)
//       .limit(limit);

//     const isNext = totalQuestions > skip + questions.length;

//     return {
//       success: true,
//       data: { collection: JSON.parse(JSON.stringify(questions)), isNext },
//     };
//   } catch (error) {
//     return handleError(error) as ErrorResponse;
//   }
// }

// export async function getSavedQuestions(
//   params: PaginatedSearchParams
// ): Promise<ActionResponse<{ collection: Collection[]; isNext: boolean }>> {
//   const validationResult = await action({
//     params,
//     schema: PaginatedSearchParamsSchema,
//     authorize: true,
//   });

//   if (validationResult instanceof Error) {
//     return handleError(validationResult) as ErrorResponse;
//   }

//   const userId = validationResult.session?.user?.id;
//   const { page = 1, pageSize = 10, query, filter } = params;

//   const skip = (Number(page) - 1) * pageSize;
//   const limit = Number(pageSize);

//   const sortOptions: Record<string, Record<string, 1 | -1>> = {
//     mostRecent: { 'question.createdAt': -1 },
//     oldest: { 'question.createdAt': 1 },
//     mostVoted: { 'question.upvotes': -1 },
//     leastVoted: { 'question.upvotes': 1 },
//     mostViewed: { 'question.views': -1 },
//     leastViewed: { 'question.views': 1 },
//     mostAnswered: { 'question.answers': -1 },
//     leastAnswered: { 'question.answers': 1 },
//   };

//   const sortCriteria = sortOptions[filter as keyof typeof sortOptions] || {
//     'question.createdAt': -1,
//   };

//   try {
//     const pipeline: PipelineStage[] = [
//       { $match: { author: new mongoose.Types.ObjectId(userId) } },
//       {
//         $lookup: {
//           from: 'questions', // 1. The name of the collection to join
//           localField: 'question', // 2. The field from the input documents
//           foreignField: '_id', // 3. The field from the documents of the "from" collection
//           as: 'questionDetails', // 4. The name of the new array field to add to the input documents
//         },
//       },
//       { $unwind: '$question' }, // Allows us to flatten the questionDetails array into a single object
//       {
//         $lookup: {
//           from: 'users', // 1. The name of the collection to join
//           localField: 'author', // 2. The field from the input documents
//           foreignField: '_id', // 3. The field from the documents of the "from" collection
//           as: 'question.author', // 4. The name of the new array field to add to the input documents
//         },
//       },
//       { $unwind: '$question.author' }, // Flatten the author array into a single object
//       {
//         $lookup: {
//           from: 'tags',
//           localField: 'question.tags',
//           foreignField: '_id',
//           as: 'question.tags',
//         },
//       },
//     ];

//     if (query) {
//       pipeline.push({
//         $match: {
//           $or: [
//             { 'question.title': { $regex: query, $options: 'i' } },
//             { 'question.content': { $regex: query, $options: 'i' } },
//           ],
//         },
//       });
//     }

//     const [totalCount] = await Collection.aggregate([
//       ...pipeline,
//       { $count: 'count' },
//     ]);

//     pipeline.push({ $sort: sortCriteria }, { $skip: skip }, { $limit: limit });
//     pipeline.push({ $project: { question: 1, author: 1 } }); // Include only the necessary fields

//     const questions = await Collection.aggregate(pipeline);
//     console.log('Questions are', questions);
//     const isNext = totalCount?.count > skip + questions.length;

//     return {
//       success: true,
//       data: {
//         collection: JSON.parse(JSON.stringify(questions)),
//         isNext,
//       },
//     };
//   } catch (error) {
//     return handleError(error) as ErrorResponse;
//   }
// }
