'use client';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';

import { globalSearch } from '@/lib/actions/general.action';
import { formUrlQuery, removeKeysFromUrlQuery } from '@/lib/url';

import GlobalResult from '../GlobalResult';
import { Input } from '../ui/input';

interface Props {
  imgSrc: string;
  placeholder: string;
  otherClasses?: string;
}

const searchGlobally = async (query: string) => {
  //   await globalSearch({ query });
};

const GlobalSearch = ({ imgSrc, placeholder, otherClasses }: Props) => {
  const searchParams = useSearchParams();
  const query = searchParams.get('global');
  const [searchQuery, setSearchQuery] = useState(query || '');
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const router = useRouter();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        // @ts-expect-error Property 'contains' does not exist on type 'EventTarget | null'.
        !searchContainerRef.current?.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('click', handleOutsideClick);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery) {
        const newUrl = formUrlQuery({
          params: searchParams.toString(),
          key: 'global',
          value: searchQuery,
        });
        searchGlobally(searchQuery);
        router.push(newUrl, { scroll: false });
      } else {
        const newUrl = removeKeysFromUrlQuery({
          params: searchParams.toString(),
          keysToRemove: ['global'],
        });

        router.push(newUrl, { scroll: false });
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchParams, router]);
  return (
    <div
      className="relative w-full max-w-[600px] max-lg:hidden"
      ref={searchContainerRef}
    >
      <div
        className={`background-light800_darkgradient flex min-h-[56px]  grow items-center gap-4 rounded-[10px] px-4 ${otherClasses}`}
      >
        <Image
          src={imgSrc}
          width={24}
          height={24}
          alt="Search"
          className="cursor-pointer"
        />

        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            if (e.target.value === '' && isOpen) setIsOpen(false);
          }}
          className="paragraph-regular no-focus placeholder text-dark400_light700 border-none shadow-none outline-none"
        />
      </div>
      {isOpen && <GlobalResult />}
    </div>
  );
};

export default GlobalSearch;
