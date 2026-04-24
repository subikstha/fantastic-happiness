'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { formUrlQuery } from '@/lib/url';
import { cn } from '@/lib/utils';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface Props {
  filters: {
    name: string;
    value: string;
  }[];
  otherClasses?: string;
  containerClasses?: string;
  selectValue?: string;
}

const CommonFilter = ({
  filters,
  otherClasses = '',
  containerClasses = '',
  selectValue,
}: Props) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramsFilter = searchParams.get('filter');
  const handleUpdateParams = (value: string) => {
    const newUrl = formUrlQuery({
      params: searchParams.toString(),
      key: 'filter',
      value,
    });

    router.push(newUrl, { scroll: false });
  };
  return (
    <div className={cn('relative', containerClasses)}>
      {/* <Select onValueChange={(value) => handleUpdateParams(value)}></Select> */}
      {/* Instead of the above we have a shorthand which is as below */}
      <Select
        onValueChange={handleUpdateParams}
        defaultValue={paramsFilter || undefined}
      >
        <SelectTrigger
          className={cn(
            'body-regular no-focus background-light800_dark300 text-dark500_light700 border px-5 py-2.5',
            otherClasses
          )}
          aria-label="Filter options" // Accesibility so that screen readers can read it
        >
          <div className="line-clamp-1 flex-1 text-left">
            <SelectValue placeholder={selectValue ?? 'Select a filter'} />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {filters.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.value}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default CommonFilter;
