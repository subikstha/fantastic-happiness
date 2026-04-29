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
import { api } from '../api';

export async function signUpWithCredentials(
  params: AuthCredentials
): Promise<ActionResponse<FastApiAuthResponse>> {
  const validationResult = await action({ params, schema: SignUpSchema });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { name, username, email, password } = validationResult.params!;
  console.log('parameters are', name, username, email, password);


  try {
    const registerResponse = await api.auth.register(email, password, name, username);
    if (!registerResponse) {
      return registerResponse as ErrorResponse;
    }
    return { success: true, data: registerResponse, status: 201 };
  } catch (error) {
    return handleError(error) as ErrorResponse;
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
