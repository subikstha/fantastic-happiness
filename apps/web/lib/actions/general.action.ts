'use server';
import { Answer, Question, Tag, User } from '@/database';

import action from '../handlers/action';
import handleError from '../handlers/error';
import { GlobalSearchSchema } from '../validations';

export async function globalSearch(params: GlobalSearchParams) {
  const validationResult = await action({
    params,
    schema: GlobalSearchSchema,
  });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { query, type } = validationResult.params!;
  const regexQuery = { $regex: query, $options: 'i' };

  const results = [];

  const typeLower = type?.toLowerCase();
  const SearchableTypes = ['question', 'answer', 'tag', 'user'];

  const modelsAndTypes = [
    { model: Question, searchField: 'title', type: 'question' },
    { model: Answer, searchField: 'content', type: 'answer' },
    { model: Tag, searchField: 'name', type: 'tag' },
    { model: User, searchField: 'name', type: 'user' },
  ];

  try {
    if (!typeLower || !SearchableTypes.includes(typeLower)) {
      // If no type is provided then we search through all the models
      for (const { model, searchField, type } of modelsAndTypes) {
        const queryResults = await model
          .find({ [searchField]: regexQuery })
          .limit(2);

        results.push(
          ...queryResults.map((item) => ({
            title:
              type === 'answer'
                ? `Answers containing ${query}`
                : item[searchField],
            type,
            id: type === 'answer' ? item.question : item._id,
          }))
        );
      }
    } else {
      // If type is provided then we search only on that particular model
      const modelInfo = modelsAndTypes.find((item) => item.type === type);

      if (!modelInfo) {
        throw new Error('Invalid search type');
      }

      const queryResults = await modelInfo.model
        .find({
          [modelInfo.searchField]: regexQuery,
        })
        .limit(8);

      results.push(
        ...queryResults.map((item) => ({
          title:
            type === 'answer'
              ? `Answers containing ${query}`
              : item[modelInfo.searchField],
          type,
          id: type === 'answer' ? item.question : item._id,
        }))
      );
    }

    console.log('Results of global search', results);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(results)),
    };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}
