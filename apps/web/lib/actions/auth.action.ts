'use server';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { signIn } from '@/auth';
import Account from '@/database/account.model';
import User from '@/database/user.model';

import action from '../handlers/action';
import handleError from '../handlers/error';
import { NotFoundError } from '../http-errors';
import { SignInSchema, SignUpSchema } from '../validations';

export async function signUpWithCredentials(
  params: AuthCredentials
): Promise<ActionResponse> {
  const validationResult = await action({ params, schema: SignUpSchema });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { name, username, email, password } = validationResult.params!;
  console.log('parameters are', name, username, email, password);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingUser = await User.findOne({ email }).session(session);

    if (existingUser) throw new Error('User already exists');

    const existingUsername = await User.findOne({ username }).session(session);

    if (existingUsername) throw new Error('Username already exists');

    const hashedPassword = await bcrypt.hash(password, 12);

    // Here we destructure to get the first user since we get back an array of all the users and we just want the first one
    const [newUser] = await User.create([{ username, name, email }], {
      session,
    });
    console.log('created user', newUser);

    await Account.create(
      [
        {
          userId: newUser._id,
          name,
          provider: 'credentials',
          providerAccountId: email,
          password: hashedPassword,
        },
      ],
      { session }
    );
    await session.commitTransaction();
    await signIn('credentials', { email, password, redirect: false });

    return { success: true };
  } catch (error) {
    await session.abortTransaction();
    return handleError(error) as ErrorResponse;
  } finally {
    await session.endSession();
  }
}

export async function signInWithCredentials(
  params: Pick<AuthCredentials, 'email' | 'password'>
): Promise<ActionResponse> {
  const validationResult = await action({ params, schema: SignInSchema });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { email, password } = validationResult.params!;

  // In the case of sign in we donot have to create a new session since we are not doing any mutations
  try {
    const existingUser = await User.findOne({ email });

    if (!existingUser) throw new NotFoundError('User');

    const existingAccount = await Account.findOne({
      provider: 'credentials',
      providerAccountId: email,
    });

    if (!existingAccount) throw new NotFoundError('Account');

    const passwordMatch = await bcrypt.compare(
      password,
      existingAccount.password
    );

    if (!passwordMatch) throw new Error('Passwords do not match');
    await signIn('credentials', { email, password, redirect: false });
    return { success: true };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}
