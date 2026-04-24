'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { MDXEditorMethods } from '@mdxeditor/editor';
import { ReloadIcon } from '@radix-ui/react-icons';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import React, { useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { toast } from '@/hooks/use-toast';
import { createAnswer } from '@/lib/actions/answer.action';
import { api } from '@/lib/api';
import { AnswerSchema } from '@/lib/validations';

import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';

const Editor = dynamic(() => import('@/components/editor'), { ssr: false });

interface Props {
  questionId: string;
  questionTitle: string;
  questionContent: string;
}

const AnswerForm = ({ questionId, questionTitle, questionContent }: Props) => {
  const [isAnswering, startAnsweringTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAISubmitting, setIsAISubmitting] = useState(false);

  const session = useSession();

  const editorRef = useRef<MDXEditorMethods>(null);
  const form = useForm<z.infer<typeof AnswerSchema>>({
    resolver: zodResolver(AnswerSchema),
    defaultValues: {
      content: '',
    },
  });

  const handleSubmit = async (values: z.infer<typeof AnswerSchema>) => {
    startAnsweringTransition(async () => {
      const result = await createAnswer({
        questionId,
        content: values.content,
      });

      if (result.success) {
        form.reset();

        toast({
          title: 'Success',
          description: 'Your answer has been posted succesfully',
        });

        if (editorRef.current) editorRef.current.setMarkdown('');
      } else {
        toast({
          title: 'Error',
          description: result.error?.message,
          variant: 'destructive',
        });
      }
    });
  };

  const generateAIAnswer = async () => {
    if (session.status !== 'authenticated') {
      return toast({
        title: 'Please log in',
        description: 'You need to be logged in to use this feature',
      });
    }
    setIsAISubmitting(true);
    const userAnswer = editorRef.current?.getMarkdown();

    try {
      const { success, data, error } = await api.ai.getAnswer(
        questionTitle,
        questionContent,
        userAnswer
      );

      if (!success)
        return toast({
          title: 'Error',
          description: error?.message,
          variant: 'destructive',
        });
      const formattedAnswer = data.replace(/<br>/g, '').toString().trim();
      if (editorRef.current) {
        console.log('ai generated answer', formattedAnswer);
        editorRef.current.setMarkdown(formattedAnswer);
        form.setValue('content', formattedAnswer);
        // The trigger is for the validation
        form.trigger('content');
      }

      toast({
        title: 'Success',
        description: 'AI answer has been generated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'There was a problem with your request',
        variant: 'destructive',
      });
    } finally {
      setIsAISubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center sm:gap-2">
        <h4>Write your answer here</h4>
        <Button
          className="btn light-border-2 gap-1.5 rounded-md border px-4 py-2.5 text-primary-500 dark:text-primary-500"
          disabled={isAISubmitting}
          onClick={generateAIAnswer}
        >
          {isAISubmitting ? (
            <>
              <ReloadIcon className="mr-2 size-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Image
                src="/icons/stars.svg"
                alt="Generate AI Answer"
                width={12}
                height={12}
                className="object-contain"
              />
              Generate AI Answer
            </>
          )}
        </Button>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className=" mt-6 flex w-full flex-col gap-10"
        >
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem className="flex w-full flex-col gap-3">
                <FormLabel className="paragraph-semibold text-dark400_light800">
                  Your answer to the problem{' '}
                  <span className="text-primary-500">*</span>
                </FormLabel>
                <FormControl>
                  <Editor
                    value={field.value}
                    editorRef={editorRef}
                    fieldChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" className="primary-gradient w-fit">
              {isSubmitting ? (
                <>
                  <ReloadIcon className="mr-2 size-4 animate-spin" />
                </>
              ) : (
                'Post Answer'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AnswerForm;
