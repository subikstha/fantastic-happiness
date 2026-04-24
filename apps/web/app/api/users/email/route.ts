import { NextResponse } from 'next/server';

import User from '@/database/user.model';
import handleError from '@/lib/handlers/error';
import { NotFoundError, ValidationError } from '@/lib/http-errors';
import dbConnect from '@/lib/mongoose';
import { UserSchema } from '@/lib/validations';

// Getting the user by email ID will be used in the auth to see if a user email exists and if so to get all the user's associated accounts
export async function POST(request: Request) {
  // This is a POST request because we want to extract the email from the body
  const { email } = await request.json();

  try {
    await dbConnect();
    // First we try to validate the data
    const validatedData = UserSchema.partial().safeParse({ email });

    if (!validatedData.success)
      throw new ValidationError(validatedData.error.flatten().fieldErrors);

    const user = await User.findOne({ email });
    if (!user) throw new NotFoundError('User');

    return NextResponse.json({ success: true, data: user }, { status: 200 });
  } catch (error) {
    return handleError(error, 'api') as APIErrorResponse;
  }
}
