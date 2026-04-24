import { redirect } from 'next/navigation';
import React from 'react';

import { auth } from '@/auth';
import EditProfileForm from '@/components/forms/EditProfileForm';
import ROUTES from '@/constants/routes';
import { getUser } from '@/lib/actions/user.action';

const EditProfile = async () => {
  const loggedInUser = await auth();
  if (!loggedInUser) redirect(ROUTES.SIGN_IN);
  const userId = loggedInUser.user?.id;
  if (!userId) redirect(ROUTES.SIGN_IN);

  const { success, data: user } = await getUser({ userId });

  if (!success || !user) return;
  console.log('This is the user in the edit page', user);
  return (
    <div>
      <h1 className="h1-bold text-dark100_light900 mb-11">Edit Profile</h1>
      <EditProfileForm user={user.user} />
    </div>
  );
};

export default EditProfile;
