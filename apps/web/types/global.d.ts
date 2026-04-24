interface Tag {
  _id: string;
  name: string;
  questions?: number;
}

interface Author {
  _id: string;
  name: string;
  image: string;
}

interface Question {
  _id: string;
  title: string;
  content: string;
  tags: Tag[];
  author: Author;
  createdAt: Date;
  upvotes: number;
  downvotes: number;
  answers: number;
  views: number;
}

//
type ActionResponse<T = null> = {
  success: boolean;
  data?: T; // Data is whatever we pass as parameter to the ActionResponse
  error?: {
    // If there is no data then we must have an error
    message: string;
    details?: Record<string, string[]>;
  };
  status?: number;
};

type SuccessResponse<T = null> = ActionResponse<T> & { success: true };
type ErrorResponse = ActionResponse<undefined> & { success: false };

type APIErrorResponse = NextResponse<ErrorResponse>;
type APIResponse<T = null> = NextResponse<SuccessResponse<T> | ErrorResponse>;

interface RouteParams {
  params: Promise<Record<string, string>>; // This Record<string,string> is a utility type that defines an object structure where each property is a key value pair both of which are strings
  searchParams: Promise<Record<string, string>>;
}

interface PaginatedSearchParams {
  page?: number;
  pageSize?: number;
  query?: string;
  filter?: string;
  sort?: string;
}

interface GetRecommendedQuestionsParams extends PaginatedSearchParams {
  userId: string;
}

interface Answer {
  _id: string;
  author: Author;
  content: string;
  upvotes: number;
  downvotes: number;
  createdAt: Date;
  question: string;
}

interface User {
  _id: string;
  name: string;
  username: string;
  email: string;
  bio?: string;
  image?: string;
  location?: string;
  portfolio?: string;
  reputation?: number;
  createdAt: Date;
}

interface Collection {
  _id: string;
  author: string | Author;
  question: Question;
}

interface BadgeCounts {
  GOLD: number;
  SILVER: number;
  BRONZE: number;
}

interface DNSData {
  dns: {
    ip: string;
    geo: string;
  };
}

interface LocationData {
  query: string;
  status: string;
  country: string;
  countryCode: string;
  retion: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
}

type CountriesData = {
  name: {
    common: string;
    nativeName: {
      ara: {
        official: string;
        common: string;
      };
    };
    official: string;
  };
  altSpellings: string[];
  area: number;
  borders: string[];
  capital: string[];
  capitalInfo: {
    latlng: number[];
  };
  cca2: string;
  cca3: string;
  ccn3: string;
  cioc: string;
}[];

interface JobSearchData {
  status: string;
  request_id: string;
  parameters: {
    country: string;
    date_posted: 'all' | 'today' | '3days' | 'week' | 'month';
    language: string;
    num_pages: number;
    page: number;
    query: string;
  };
  data: {
    apply_options: {
      publisher: string;
      apply_link: string;
      is_direct: boolean;
    };
    employer_logo: string | null;
    employer_name: string | null;
    employer_website: string | null;
    job_apply_is_direct: true;
    job_apply_link: string | null;
    job_benefits: null;
    job_city: string;
    job_country: string;
    job_description: string | null;
    job_employment_type: string;
    job_employment_types: string[];
    job_google_link: string | null;
    job_highlights: {
      Qualifications: string[];
      Responsibilities: string[];
    };
    job_id: string;
    job_title: string;
    job_is_remote: boolean;
    job_latitude: number;
    job_longitude: number;
    job_location: string;
    job_max_salary: number | string | null;
    job_min_salary: number | string | null;
    job_onet_job_zone: string;
    job_onet_soc: string;
    job_posted_at_datetime_utc: string | null;
    job_posted_at_timestamp: string | null;
    job_publisher: string;
    job_salary: number | string | null;
    job_salary_period: string | number | null;
    job_state: string;
  }[];
}

interface GlobalSearchedItem {
  id: string;
  type: 'question' | 'answer' | 'user' | 'tag';
  title: string;
}

interface UpdateUserParams {
  name: string;
  username: string;
  portfolio: string | undefined;
  location: string;
  bio?: string;
}
// NOTE: There was an import ReactNode at the top of this file which was messing up the global type imports
