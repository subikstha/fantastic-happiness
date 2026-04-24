import { NextResponse } from 'next/server';

import Account from '@/database/account.model';
import handleError from '@/lib/handlers/error';
import { NotFoundError, ValidationError } from '@/lib/http-errors';
import dbConnect from '@/lib/mongoose';
import { AccountSchema } from '@/lib/validations';

// GET /api/users/[id]
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) throw new NotFoundError('Account');

  try {
    await dbConnect();
    const account = await Account.findById(id);

    if (!account) throw new NotFoundError('Account');

    return NextResponse.json({ success: true, data: account }, { status: 200 });
  } catch (error) {
    return handleError(error, 'api') as APIErrorResponse;
  }
}

// DELETE /api/users/[id]
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) throw new NotFoundError('Account');

  try {
    await dbConnect();
    const account = await Account.findByIdAndDelete(id);

    if (!account) throw new NotFoundError('User');

    return NextResponse.json({ success: true, data: account }, { status: 200 });
  } catch (error) {
    return handleError(error, 'api') as APIErrorResponse;
  }
}

// PUT /api/users/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) throw new NotFoundError('Account');

  try {
    await dbConnect();
    // Validating the data
    const body = request.json();
    const validatedData = AccountSchema.partial().safeParse(body); // Adrian says that we safeparse it because in the body we might have something that are better kept private

    if (!validatedData.success)
      throw new ValidationError(validatedData.error.flatten().fieldErrors);

    const updatedAccount = await Account.findByIdAndUpdate(id, validatedData, {
      new: true,
    }); // We put {new: true} so that we get the user after update is completed
    if (!updatedAccount) throw new NotFoundError('Account');

    return NextResponse.json(
      { success: true, data: updatedAccount },
      { status: 200 }
    );
  } catch (error) {
    return handleError(error, 'api') as APIErrorResponse;
  }
}

// Just testing 
