'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DefaultValues,
  FieldValues,
  Path,
  SubmitHandler,
  useForm,
  Resolver,
} from 'react-hook-form';
import { z, ZodType } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import ROUTES from '@/constants/routes';
import { toast } from '@/hooks/use-toast';

interface AuthFormProps<T extends FieldValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodType<T, any, any>;
  defaultValues: T;
  onSubmit: (data: T) => Promise<ActionResponse>;
  formType: 'SIGN_IN' | 'SIGN_UP';
}

const AuthForm = <T extends FieldValues>({
  schema,
  defaultValues,
  formType,
  onSubmit,
}: AuthFormProps<T>) => {
  const router = useRouter();
  // 1. Define the form
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema) as unknown as Resolver<T>,
    defaultValues: defaultValues as DefaultValues<T>,
  });

  const handleSubmit: SubmitHandler<T> = async (data) => {
    console.log('data', data);
    // TODO Authenticate User
    const result = (await onSubmit(data)) as ActionResponse;

    if (result?.success) {
      toast({
        title: 'Success',
        description:
          formType === 'SIGN_IN'
            ? 'Signed in successfully'
            : 'Signed up successfully',
      });
      router.push(ROUTES.HOME);
    } else {
      toast({
        title: `Error ${result?.status}`,
        description: result?.error?.message,
        variant: 'destructive',
      });
    }
  };

  const buttonText = formType === 'SIGN_IN' ? 'Sign In' : 'Sign Up';

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="mt-6 space-y-6"
      >
        {Object.keys(defaultValues).map((field) => (
          <FormField
            key={field}
            control={form.control}
            name={field as Path<T>}
            render={({ field }) => (
              <FormItem className="flex w-full flex-col gap-2.5">
                <FormLabel className="paragraph-medium text-dark400_light700">
                  {field.name === 'email'
                    ? 'Email Address'
                    : field.name.charAt(0).toUpperCase() + field.name.slice(1)}
                </FormLabel>
                <FormControl>
                  <Input
                    required
                    type={
                      field.name === 'password'
                        ? 'password'
                        : field.name === 'email'
                          ? 'email'
                          : 'text'
                    }
                    {...field}
                    className="paragraph-regular background-light900_dark300 light-border-2 text-dark300_light700 no-focus min-h-12 rounded-1.5 border"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
        <Button
          disabled={form.formState.isSubmitting}
          type="submit"
          className="primary-gradient paragraph-medium min-h-12 w-full rounded-2 px-4 py-3 font-inter !text-light-900"
        >
          {form.formState.isSubmitting
            ? buttonText === 'Sign In'
              ? 'Signing In...'
              : 'Signing Up...'
            : buttonText}
        </Button>

        {formType === 'SIGN_IN' ? (
          <p>
            Don&apos;t have an account?{' '}
            <Link
              className="paragraph-semibold primary-text-gradient"
              href={ROUTES.SIGN_UP}
            >
              Sign Up
            </Link>
          </p>
        ) : (
          <p>
            Already have an account?{' '}
            <Link
              className="paragraph-semibold primary-text-gradient"
              href={ROUTES.SIGN_IN}
            >
              Sign In
            </Link>
          </p>
        )}
      </form>
    </Form>
  );
};

export default AuthForm;
