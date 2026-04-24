import { NextResponse } from 'next/server';

import Account from '@/database/account.model';
import handleError from '@/lib/handlers/error';
import { ForbiddenError } from '@/lib/http-errors';
import dbConnect from '@/lib/mongoose';
import { AccountSchema } from '@/lib/validations';

export async function GET() {
  try {
    await dbConnect();
    const accounts = await Account.find();
    return NextResponse.json(
      { success: true, data: accounts },
      { status: 200 }
    );
  } catch (error) {
    return handleError(error, 'api') as APIErrorResponse;
  }
}

// Create User
export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    // We donot do safeParse() because we donot have a password
    // only after doing safeParse() we get the success method so we donot have to check for success as well
    const validatedData = AccountSchema.parse(body);

    // if (!validatedData.success) {
    //   throw new ValidationError(validatedData.error.flatten().fieldErrors);
    // }

    const existingAccount = await Account.findOne({
      provider: validatedData.provider,
      providerAccountId: validatedData.providerAccountId,
    });

    if (existingAccount)
      throw new ForbiddenError(
        'An account with the same provider already exists'
      );

    const newAccount = await Account.create(validatedData);

    return NextResponse.json(
      { status: true, data: newAccount },
      { status: 201 }
    ); // Status code 201 means created
  } catch (error) {
    handleError(error, 'api') as APIErrorResponse;
  }
}
