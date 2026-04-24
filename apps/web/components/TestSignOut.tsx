'use client';
import { signOut } from 'next-auth/react';
import React from 'react';

import { Button } from './ui/button';

const TestSignOut = () => {
  return <Button onClick={() => signOut()}>Sign Out</Button>;
};

export default TestSignOut;
