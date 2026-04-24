import React from 'react';

import JobsCard from '@/components/cards/JobsCard';
import DataRenderer from '@/components/DataRenderer';
import JobsCountriesFilter from '@/components/filters/JobsCountriesFilter';
import LocalSearch from '@/components/search/LocalSearch';
import ROUTES from '@/constants/routes';
import { JOBS_EMPTY } from '@/constants/states';
import { api } from '@/lib/api';

const FindJobs = async ({ searchParams }: RouteParams) => {
  // Get the query and country from the search params
  const { query, country } = await searchParams;

  // 1. First we get the IP address using the following api call
  const result = await api.location.getDnsInfo();
  const {
    dns: { ip },
  } = result || {};
  // 2. Second we get the country where the user is located
  const { countryCode } = await api.location.getIpInfo(ip);
  // 3. Get all the countries to be displayed in the combobox
  const countries = await api.countries.getAllCountries();

  // 4. Call the Jobsearch API based on the search parameters
  const { status, data: jobsData } = await api.jobs.getJobsByLocation(
    country,
    query
  );

  console.log('Jobs data in the page', jobsData);

  return (
    <div>
      <h1 className="h1-bold text-dark100_light900">Jobs</h1>
      <div className="mt-11 flex gap-5">
        <div className=" flex flex-1 items-center gap-5">
          <LocalSearch
            route={ROUTES.JOBS}
            imgSrc="/icons/search.svg"
            iconPosition="left"
            placeholder="Job Title, Company or Keywords"
            otherClasses="flex-1"
          />
          <JobsCountriesFilter
            countries={countries}
            triggerClasses="w-full justify-start min-h-[56px] body-regular no-focus background-light800_dark300 text-dark500_light700 border px-5 py-2.5"
            popoverTriggerClasses="flex-1"
            defaultCountryCode={countryCode}
          />
        </div>
        {/* <Button className="primary-gradient min-h-[56px]">Find Jobs</Button> */}
      </div>
      {/* List of jobs here */}
      <DataRenderer
        success={status === 'OK'}
        empty={JOBS_EMPTY}
        data={jobsData}
        render={(jobsData) => (
          <div className="mt-10 flex flex-col gap-6">
            {jobsData.map((job) => (
              <JobsCard
                key={job.job_title}
                title={job.job_title}
                employer={job.employer_name}
                employerLogo={job.employer_logo}
                description={job.job_description}
                country={job.job_country}
                city={job.job_city}
                employmentType={job.job_employment_type}
                minSalary={job.job_min_salary}
                maxSalary={job.job_max_salary}
                link={job.job_apply_link}
              />
            ))}
          </div>
        )}
      />
    </div>
  );
};

export default FindJobs;
