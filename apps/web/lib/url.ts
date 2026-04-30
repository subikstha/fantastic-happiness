import qs from 'query-string';

let formUrlQueryCallCount = 0;
let removeKeysFromUrlQueryCallCount = 0;

interface UrlQueryParams {
  params: string;
  key: string;
  value: string;
}

export const formUrlQuery = ({ params, key, value }: UrlQueryParams) => {
  const queryString = qs.parse(params);
  // queryString = {query: "Hello Nextjs"}

  queryString[key] = value;

  formUrlQueryCallCount += 1;
  const result = qs.stringifyUrl({
    url: window.location.pathname,
    query: queryString,
  });
  console.log(
    `[formUrlQuery #${formUrlQueryCallCount}]`,
    'queryString, pathname, result:',
    queryString,
    window.location.pathname,
    result
  );
  return result;
};

interface RemoveUrlQueryParams {
  params: string;
  keysToRemove: string[];
}

export const removeKeysFromUrlQuery = ({
  params,
  keysToRemove,
}: RemoveUrlQueryParams) => {
  const queryString = qs.parse(params);
  // queryString = {query: "Hello Nextjs"}
  keysToRemove.forEach((key) => {
    delete queryString[key];
  });

  removeKeysFromUrlQueryCallCount += 1;
  const result = qs.stringifyUrl(
    {
      url: window.location.pathname,
      query: queryString,
    },
    { skipNull: true }
  );
  console.log(
    `[removeKeysFromUrlQuery #${removeKeysFromUrlQueryCallCount}]`,
    'queryString, pathname, result:',
    queryString,
    window.location.pathname,
    result
  );
  return result;
};
