'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import React, { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import z from 'zod';

import ROUTES from '@/constants/routes';
import { toast } from '@/hooks/use-toast';
import { updateUser } from '@/lib/actions/user.action';
import { EditProfileSchema } from '@/lib/validations';

import { Button } from '../ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

interface Props {
  user: User;
}

const EditProfileForm = ({ user }: Props) => {
  const [isPending, startTransition] = useTransition();
  const { name, username, bio, portfolio, location } = user;
  const router = useRouter();
  const form = useForm<z.infer<typeof EditProfileSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(EditProfileSchema) as any,
    defaultValues: {
      username,
      name,
      bio: bio ?? '',
      portfolio: portfolio ?? '',
      location: location ?? '',
    },
  });

  const handleSubmit = async (values: z.infer<typeof EditProfileSchema>) => {
    console.log('submitting edit profile form with', values);
    const { name, username, location, bio, portfolio } = values;
    startTransition(async () => {
      try {
        const { success, data: updatedUser } = await updateUser({
          name,
          username,
          location,
          bio,
          portfolio,
        });

        console.log('success and updated user', success, updatedUser);

        if (success) {
          toast({
            title: 'Success',
            description: 'User updated successfully',
          });
          router.push(ROUTES.PROFILE(user._id));
        }
      } catch (error) {
        console.error('error', error);
        toast({
          title: `Error`,
          description: 'Something went wrong',
          variant: 'destructive',
        });
      }
    });
  };
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="flex flex-col gap-9">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="flex w-full flex-col">
                <FormLabel className="paragraph-semibold text-dark400_light800">
                  Full Name <span className="text-primary-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    className="paragraph-regular background-light700_dark300 light-border-2 text-dark300_light700 no-focus min-h-[56px] border"
                    {...field}
                    placeholder="Your Full Name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem className="flex w-full flex-col">
                <FormLabel className="paragraph-semibold text-dark400_light800">
                  Username <span className="text-primary-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    className="paragraph-regular background-light700_dark300 light-border-2 text-dark300_light700 no-focus min-h-[56px] border"
                    {...field}
                    placeholder="Your Username"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="portfolio"
            render={({ field }) => (
              <FormItem className="flex w-full flex-col">
                <FormLabel className="paragraph-semibold text-dark400_light800">
                  Portfolio Link
                </FormLabel>
                <FormControl>
                  <Input
                    className="paragraph-regular background-light700_dark300 light-border-2 text-dark300_light700 no-focus min-h-[56px] border placeholder:text-neutral-200"
                    {...field}
                    placeholder="http://www.yourportfoliolink.com"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem className="flex w-full flex-col">
                <FormLabel className="paragraph-semibold text-dark400_light800">
                  Location <span className="text-primary-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    className="paragraph-regular background-light700_dark300 light-border-2 text-dark300_light700 no-focus min-h-[56px] border"
                    {...field}
                    placeholder="location"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem className="flex w-full flex-col">
                <FormLabel className="paragraph-semibold text-dark400_light800">
                  Bio
                </FormLabel>
                <FormControl>
                  <Textarea
                    className="paragraph-regular background-light700_dark300 light-border-2 text-dark300_light700 no-focus min-h-[120px] border"
                    {...field}
                    placeholder="Tell something about yourself..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="primary-gradient w-fit !text-light-900"
            disabled={isPending}
          >
            {isPending ? <>Submitting...</> : <>Submit</>}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default EditProfileForm;
