'use server';

import { Session } from 'next-auth';
import { ZodError, ZodSchema } from 'zod';

import { auth } from '@/auth';

import { UnauthorizedError, ValidationError } from '../http-errors';
import dbConnect from '../mongoose';

// We are gonna pass some generic params into each server actions and then we want to create schemas based on those params
// and it has to be generic because it will be different for different server actions
// For example for User validation T will contain the user data, for account it will contain the account data and so on
type ActionOptions<T> = {
  params?: T;
  schema?: ZodSchema<T>;
  authorize?: boolean;
};

async function action<T>({
  params,
  schema,
  authorize = false,
}: ActionOptions<T>) {
  if (schema && params) {
    try {
      schema.parse(params);
    } catch (error) {
      if (error instanceof ZodError) {
        return new ValidationError(
          error.flatten().fieldErrors as Record<string, string[]>
        );
      } else {
        return new Error('Schema validation failed');
      }
    }
  }

  let session: Session | null = null;
  if (authorize) {
    session = await auth();
    // console.log('session in action util', session);

    if (!session) {
      return new UnauthorizedError();
    }
  }
  await dbConnect();
  return { params, session };
}

export default action;

// 1. Checking whether the schema and params are provided and validated
// 2. Checking whether the user is authenticated
// 3. Connecting to the database
// 4. Returning the params and session
