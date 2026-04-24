import { auth } from '@/auth';
import QuestionCard from '@/components/cards/QuestionCard';
import DataRenderer from '@/components/DataRenderer';
import CommonFilter from '@/components/filters/CommonFilter';
import HomeFilter from '@/components/filters/HomeFilter';
import Pagination from '@/components/Pagination';
import LocalSearch from '@/components/search/LocalSearch';
import { CollectionFilters } from '@/constants/filters';
import { EMPTY_QUESTION } from '@/constants/states';
import { getSavedQuestions } from '@/lib/actions/collection.action';

interface SearchParams {
  searchParams: Promise<{ [key: string]: string }>;
}

const Collection = async ({ searchParams }: SearchParams) => {
  const { page, pageSize, query, filter } = await searchParams;

  const { success, data, error } = await getSavedQuestions({
    page: Number(page) || 1, // Convert to number because searchParams are strings
    pageSize: Number(pageSize) || 10,
    query: query || '',
    filter: filter || '',
  });

  const { collection, isNext } = data || {};

  console.log('Collection is', collection);
  return (
    <>
      <section className=" flex w-full flex-col-reverse justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="h1-bold text-dark100_light900">Saved Questions</h1>
      </section>
      <section className="mt-11 flex justify-between gap-5 max-sm:flex-col sm:items-center">
        <LocalSearch
          route="/"
          imgSrc="/icons/search.svg"
          placeholder="Search questions..."
          otherClasses="flex-1"
        />
        <CommonFilter
          filters={CollectionFilters}
          otherClasses="min-h-[56px] sm:min-w-[170px]"
        />
      </section>
      <HomeFilter />
      <DataRenderer
        success={success}
        error={error}
        data={collection}
        empty={EMPTY_QUESTION}
        render={(collection) => (
          <div className="mt-10 flex w-full flex-col gap-6">
            {collection.map((item) => (
              <QuestionCard key={item._id} question={item.question} />
            ))}
          </div>
        )}
      />
      <Pagination page={page} isNext={isNext || false} />
    </>
  );
};

export default Collection;
