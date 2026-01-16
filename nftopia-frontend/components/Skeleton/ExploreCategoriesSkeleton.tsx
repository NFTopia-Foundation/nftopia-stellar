import React from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css';

const ExploreCategoriesSkeleton = () => {
  return (

    <section className="py-20 overflow-hidden relative">
      {/* Background elements can remain unchanged */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center mb-16">
          <div className="inline-block relative">
            {/* Replace the heading with a skeleton */}
            <Skeleton height={48} width={300} className="mb-4" />
            {/* Mimic the underline gradients with a thin skeleton */}
            <Skeleton height={4} width={250} className="mb-2" />
            <Skeleton height={4} width={200} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Render a fixed number of skeleton cards (e.g., 6 placeholders) */}
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="group">
              <div className="bg-gray-900/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-[#db74cf]/30 transition-all duration-300">
                <div className="p-3">
                  <div className="grid grid-cols-3 gap-2">
                    {/* Main image skeleton */}
                    <div
                      className="col-span-3 relative overflow-hidden rounded-xl"
                      style={{ height: '140px' }}
                    >
                      <Skeleton height={140} width="100%" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    </div>

                    {/* Smaller images skeletons */}
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="relative overflow-hidden rounded-lg"
                        style={{ height: '70px' }}
                      >
                        <Skeleton height={70} width="100%" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 flex justify-between items-center">
                  {/* Title skeleton */}
                  <Skeleton height={24} width={120} />
                  {/* Count badge skeleton */}
                  <Skeleton height={24} width={60} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section divider remains as is */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
    </section>
  );
}

export default ExploreCategoriesSkeleton
