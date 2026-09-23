import React from 'react';

// Loading skeleton. animate-pulse, same as the Overview shimmer.
const Bar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-[#eceef2] ${className}`} />
);

const CARD =
  'rounded-[15px] border border-[#eceef2] bg-white shadow-[0_1px_3px_-1px_rgba(21,22,29,0.07)]';

const ViniActionItemsShimmer: React.FC = () => (
  <div className="flex flex-col gap-4">
    <Bar className="h-6 w-[180px] rounded-lg" />

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Bar key={index} className="h-[76px] rounded-2xl" />
      ))}
    </div>

    <div className="flex items-center gap-4 border-b border-[#eceef2] pb-2.5">
      {Array.from({ length: 3 }).map((_, index) => (
        <Bar key={index} className="h-3.5 w-[86px]" />
      ))}
    </div>

    <div className={`${CARD} flex flex-col gap-2.5 px-3 py-2.5`}>
      <Bar className="h-9 w-full rounded-lg" />
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <Bar key={index} className="h-6 w-[104px] rounded-full" />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Bar key={index} className="h-8 w-[136px] rounded-lg" />
        ))}
      </div>
    </div>

    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex flex-col gap-2 lg:w-[380px] lg:flex-none">
        <Bar className="h-3 w-[120px]" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className={`${CARD} flex flex-col gap-2 p-3.5`}>
            <div className="flex items-center gap-2">
              <Bar className="h-3 w-[104px]" />
              <Bar className="ml-auto h-4 w-[70px] rounded-full" />
            </div>
            <Bar className="h-2.5 w-full" />
            <Bar className="h-2.5 w-[62%]" />
          </div>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Bar className="h-3 w-[110px]" />
        <div className={`${CARD} flex flex-col gap-4 p-5`}>
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2.5">
              <Bar className="h-4 w-[92px] rounded-full" />
              <Bar className="h-3.5 w-[76%]" />
              <Bar className="h-2.5 w-full" />
              <Bar className="h-2.5 w-[54%]" />
              <div className="flex gap-2">
                <Bar className="h-8 flex-1 rounded-xl" />
                <Bar className="h-8 w-[92px] rounded-xl" />
                <Bar className="h-8 w-[100px] rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default ViniActionItemsShimmer;
