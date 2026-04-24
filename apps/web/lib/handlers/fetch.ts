import { RequestError } from '../http-errors';
import logger from '../logger';
import handleError from './error';

interface FetchOptions extends RequestInit {
  timeout?: number;
}

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export async function fetchHandler<T>(
  url: string,
  options: FetchOptions & { raw?: boolean } = {}
): Promise<T> {
  const {
    raw = false,
    timeout = 100000,
    headers: customHeaders = {},
    ...restOptions
  } = options;

  // AbortController is built into the DOM allowing us to abort a request
  // We can then set a timeout to automatically abort a request if it takes too long
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  //   Getting the headers
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const headers: HeadersInit = { ...defaultHeaders, ...customHeaders };
  const config: RequestInit = {
    ...restOptions,
    headers,
    signal: controller.signal, // This is the signal to support request cancellation
  };

  try {
    const response = await fetch(url, config);
    clearTimeout(id);

    if (!response.ok)
      throw new RequestError(response.status, `HTTP Error: ${response.status}`);
    const json = await response.json();
    return (raw ? json : (json as ActionResponse<T>)) as T;
  } catch (err) {
    const error = isError(err) ? err : new Error('Unknown Error');
    if (error.name === 'AbortError') {
      logger.warn(`Request to ${url} timed out`);
    } else {
      logger.error(`Error fetching ${url}: ${error.message}`);
    }

    return handleError(error) as T;
  }
}
