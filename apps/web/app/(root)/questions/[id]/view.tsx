'use client';

import { toast } from '@/hooks/use-toast';
import { incrementViews } from '@/lib/actions/question.action';
import { useEffect } from 'react';

const View = ({ questionId }: { questionId: string }) => {
  console.log('this is the question id in view component', questionId);
  const handleIncrement = async () => {
    const result = await incrementViews({ questionId });

    if (result.success) {
      toast({
        title: 'Success',
        description: 'Views Incremented',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error?.message,
        variant: 'destructive',
      });
    }
  };
  useEffect(() => {
    handleIncrement();
  }, []);
  return null;
};

export default View;
