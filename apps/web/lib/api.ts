import ROUTES from '@/constants/routes';
import { IAccount } from '@/database/account.model';
import { IUser } from '@/database/user.model';

import { fetchHandler } from './handlers/fetch';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
const DNS_API_URL = process.env.IP_DNS_API_URL;
const LOCATION_API_URL = process.env.IP_LOCATION_API_URL;
const JOBS_API_URL = process.env.JOB_SEARCH_API_URL;
const COUNTRIES_API_URL = process.env.COUNTRIES_API_URL;

export const api = {
  auth: {
    oAuthSignIn: ({
      user,
      provider,
      providerAccountId,
    }: SignInWithOAuthParams) =>
      fetchHandler(`${API_BASE_URL}/auth/${ROUTES.SIGN_IN_WITH_OAUTH}`, {
        method: 'POST',
        body: JSON.stringify({ user, provider, providerAccountId }),
      }),
  },
  users: {
    getAll: () => fetchHandler(`${API_BASE_URL}/users`),
    getById: (id: string) => fetchHandler(`${API_BASE_URL}/users/${id}`),
    getByEmail: (email: string) =>
      fetchHandler(`${API_BASE_URL}/users/email`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    create: (userData: Partial<IUser>) =>
      fetchHandler(`${API_BASE_URL}/users`, {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    update: (id: string, userData: Partial<IUser>) =>
      fetchHandler(`${API_BASE_URL}/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      }),
    delete: (id: string) =>
      fetchHandler(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
      }),
  },
  accounts: {
    getAll: () => fetchHandler(`${API_BASE_URL}/accounts`),
    getById: (id: string) => fetchHandler(`${API_BASE_URL}/accounts/${id}`),
    getByProvider: (providerAccountId: string) =>
      fetchHandler(`${API_BASE_URL}/accounts/provider`, {
        method: 'POST',
        body: JSON.stringify({ providerAccountId }),
      }),
    create: (accountData: Partial<IAccount>) =>
      fetchHandler(`${API_BASE_URL}/accounts`, {
        method: 'POST',
        body: JSON.stringify(accountData),
      }),
    update: (id: string, accountData: Partial<IAccount>) =>
      fetchHandler(`${API_BASE_URL}/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(accountData),
      }),
    delete: (id: string) =>
      fetchHandler(`${API_BASE_URL}/accounts/${id}`, {
        method: 'DELETE',
      }),
  },
  ai: {
    getAnswer: (
      question: string,
      content: string,
      userAnswer?: string
    ): APIResponse<string> =>
      fetchHandler(`${API_BASE_URL}/ai/answers`, {
        method: 'POST',
        body: JSON.stringify({ question, content, userAnswer }),
      }),
  },
  location: {
    getDnsInfo: () =>
      fetchHandler<DNSData>(`${DNS_API_URL}`, {
        raw: true,
        method: 'GET',
      }),
    getIpInfo: (ipAddress: string) =>
      fetchHandler<LocationData>(`${LOCATION_API_URL}${ipAddress}`, {
        raw: true,
        method: 'GET',
      }),
  },
  countries: {
    getAllCountries: () =>
      fetchHandler<CountriesData>(
        `${COUNTRIES_API_URL}independent?status=true`,
        {
          method: 'GET',
          raw: true,
        }
      ),
  },
  jobs: {
    getJobsByLocation: (
      country: string,
      query: string,
      page?: number,
      numPages?: number,
      datePosted?: 'all' | 'today' | '3days' | 'week' | 'month'
    ) =>
      fetchHandler<JobSearchData>(
        `${JOBS_API_URL}search?query=${query}&page=${page ?? 1}&num_pages=${numPages ?? 1}&country=${country}&date_posted=${datePosted ?? 'all'}`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-key': `${process.env.RAPID_API_KEY}`,
            'x-rapidapi-host': 'jsearch.p.rapidapi.com',
          },
        }
      ),
  },
};
