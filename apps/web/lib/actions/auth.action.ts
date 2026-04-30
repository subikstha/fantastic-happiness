'use server';

import { signIn } from '@/auth';

import { api } from '../api';
import action from '../handlers/action';
import handleError from '../handlers/error';
import { SignInSchema, SignUpSchema } from '../validations';

export async function signUpWithCredentials(
  params: AuthCredentials
): Promise<ActionResponse<FastApiAuthResponse>> {
  const validationResult = await action({ params, schema: SignUpSchema });

  if (validationResult instanceof Error) {
    return handleError(validationResult) as ErrorResponse;
  }

  const { name, username, email, password } = validationResult.params!;

  try {
    const registerResponse = await api.auth.register(email, password, name, username);
    if (!registerResponse.success) {
      return registerResponse;
    }

    // Need to sign in the user after registration to create a session
    await signIn('credentials', { email, password, redirect: false });

    return {
      success: true,
      data: registerResponse.data,
      status: registerResponse.status ?? 200,
    };
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

  try {
    // Credentials verification now happens in NextAuth authorize via FastAPI login.
    await signIn('credentials', { email, password, redirect: false });
    return { success: true, status: 200 };
  } catch (error) {
    return handleError(error) as ErrorResponse;
  }
}
