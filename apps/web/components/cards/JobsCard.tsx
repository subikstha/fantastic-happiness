import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '../ui/badge';

interface Props {
  title: string;
  employerLogo: string | null;
  employer: string | null;
  description: string | null;
  country: string;
  city: string;
  employmentType: string | null;
  minSalary: string | number | null;
  maxSalary: string | number | null;
  link: string | null;
}

const JobsCard = ({
  title,
  employerLogo,
  employer,
  description,
  country,
  city,
  employmentType,
  minSalary,
  maxSalary,
  link,
}: Props) => {
  return (
    <div className="card-wrapper flex gap-6 rounded-[10px] p-9 sm:px-11">
      <div className="relative size-[64px] shrink-0">
        <Image
          src={employerLogo ?? '/images/jobs_logo.png'}
          fill
          alt={`${employer} logo`}
          className="flex-1 shrink-0 rounded-[10px]"
        />
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="base-semibold text-dark200_light900 ">{title}</h3>
            {description && (
              <p className="text-dark500_light700 body-regular line-clamp-2">
                {description}
              </p>
            )}
          </div>
          <div className="shrink-0">
            <Badge className="body-medium background-light800_dark400  rounded-full">
              <span className="text-dark400_light700">{`${city}, ${country}`}</span>
            </Badge>
          </div>
        </div>
        <div className="flex justify-between gap-6">
          <div>
            {employmentType && (
              <div className="flex gap-2">
                <Image
                  src="/icons/clock-2.svg"
                  width={16}
                  height={16}
                  alt="clock icon"
                />
                <span className="text-light-500">{employmentType}</span>
              </div>
            )}
            {minSalary && maxSalary && (
              <div className="flex gap-2">
                <Image
                  src="/icons/currency-dollar-circle.svg"
                  width={16}
                  height={16}
                  alt="currency icon"
                />
                <span className="text-light-500">
                  {minSalary}-{maxSalary}
                </span>
              </div>
            )}
          </div>
          {link && (
            <Link
              href={link}
              className="primary-text-gradient flex gap-2"
              target="_blank"
            >
              Apply Now
              <Image
                src="/icons/arrow-up-right.svg"
                width={20}
                height={20}
                alt="arrow up icon"
              />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobsCard;
