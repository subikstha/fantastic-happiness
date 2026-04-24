import qs from 'query-string';

interface UrlQueryParams {
  params: string;
  key: string;
  value: string;
}

export const formUrlQuery = ({ params, key, value }: UrlQueryParams) => {
  const queryString = qs.parse(params);
  // queryString = {query: "Hello Nextjs"}

  queryString[key] = value;

  console.log(
    'queryString, current pathname and returned values are',
    queryString,
    window.location.pathname,
    qs.stringifyUrl({ url: window.location.pathname, query: queryString })
  );
  return qs.stringifyUrl({
    url: window.location.pathname,
    query: queryString,
  });
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

  console.log(
    'queryString, current pathname and returned values are',
    queryString,
    window.location.pathname,
    qs.stringifyUrl({ url: window.location.pathname, query: queryString })
  );
  return qs.stringifyUrl(
    {
      url: window.location.pathname,
      query: queryString,
    },
    { skipNull: true }
  );
};
