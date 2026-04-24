import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import slugify from 'slugify';

import Account from '@/database/account.model';
import User from '@/database/user.model';
import handleError from '@/lib/handlers/error';
import { ValidationError } from '@/lib/http-errors';
import dbConnect from '@/lib/mongoose';
import { SignInWithOAuthSchema } from '@/lib/validations';

export async function POST(request: Request) {
  const { provider, providerAccountId, user } = await request.json();

  await dbConnect();

  // Mongoose sessions are a part of mongodb's transactions feature allowing multiple operations to be done at a single atomic unit
  // They ensure that all operations to be executed at a single atomic unit
  // They ensure that all operations succeed or none are applied

  // For example
  // If we try to create an account -> Fails
  // We try to create a user -> Should Fail

  // In programming these are called as atomic functions (Functions that try to do one thing or nothing at all)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. We try to sign our user using OAuth
    const validatedData = SignInWithOAuthSchema.safeParse({
      provider,
      providerAccountId,
      user,
    });

    if (!validatedData.success)
      throw new ValidationError(validatedData.error.flatten().fieldErrors);

    const { name, username, email, image } = user;

    // 2. We generate a slugified username
    const slugifiedUsername = slugify(username, {
      lower: true,
      strict: true,
      trim: true,
    });

    //  3. We try to find that existing user
    let existingUser = await User.findOne({ email }).session(session); // This session is regarding the mongoose session

    // 4. If a user doesn't exist then we create it
    if (!existingUser) {
      [existingUser] = await User.create([
        { name, username: slugifiedUsername, email },
        { session },
      ]);
    } else {
      const updatedData: { name?: string; image?: string } = {};

      if (existingUser.name !== name) updatedData.name = name;
      if (existingUser.image !== image) updatedData.image = image;

      if (Object.keys(updatedData).length > 0) {
        await User.updateOne(
          {
            _id: existingUser._id,
          },
          { $set: updatedData }
        ).session(session);
      }
    }

    // Finding an existing account attached to the user id
    const existingAccount = await Account.findOne({
      userId: existingUser._id,
      provider,
      providerAccountId,
    }).session(session);

    // If no existing account is found then we create a new account
    if (!existingAccount) {
      await Account.create(
        [
          {
            userId: existingUser._id,
            name,
            image,
            provider,
            providerAccountId,
          },
        ],
        { session }
      );
    }

    // Apply all changes to the database atomically
    await session.commitTransaction();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    await session.abortTransaction();
    return handleError(error, 'api') as APIErrorResponse;
  } finally {
    session.endSession();
  }
}
