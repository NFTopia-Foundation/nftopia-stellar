import React, { useState, useEffect } from 'react';


const SellerSkeleton = () => (
  <div className="relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 animate-pulse bg-gray-800 border border-gray-700/50">
    <div className="flex items-center p-4 gap-3">
      <div className="w-12 h-12 rounded-full bg-gray-700"></div>
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-700 rounded w-1/2"></div>
      </div>
    </div>
  </div>
);

const TopSellersSection = () => {
  const [sellers, setSellers] = useState<Seller[]>();
  const [isLoading, setIsLoading] = useState(true);

  interface Seller {
    id: string;
    name: string;
    amount: string;
    avatar: string;
    highlight?: boolean;
  }

  useEffect(() => {
    // Simulate data fetching
    setTimeout(() => {
      setSellers([
        {
          id: "1",
          name: "Leighton Kramer",
          amount: "276.4 STK",
          avatar: "/avatars/avatar-1.jpg",
          highlight: true,
        },
        {
          id: "2",
          name: "Haylie Arcand",
          amount: "146.8 STK",
          avatar: "/avatars/avatar-2.jpg",
        },
        {
          id: "3",
          name: "Bowen Higgins",
          amount: "98.2 STK",
          avatar: "/avatars/avatar-3.jpg",
        },
        {
          id: "4",
          name: "Saige Fuentes",
          amount: "94.7 STK",
          avatar: "/avatars/avatar-4.jpg",
        },
        {
          id: "5",
          name: "Sophie Maddox",
          amount: "72.6 STK",
          avatar: "/avatars/avatar-5.jpg",
        },
        {
          id: "6",
          name: "Jeremy Burch",
          amount: "70.3 STK",
          avatar: "/avatars/avatar-6.jpg",
        },
        {
          id: "7",
          name: "Amelia Griffin",
          amount: "65.4 STK",
          avatar: "/avatars/avatar-7.jpg",
        },
        {
          id: "8",
          name: "Isabella Hart",
          amount: "59.2 STK",
          avatar: "/avatars/avatar-8.jpg",
        },
        {
          id: "9",
          name: "Diego Bentley",
          amount: "50.7 STK",
          avatar: "/avatars/avatar-9.jpg",
        },
        {
          id: "10",
          name: "Daisy Lozano",
          amount: "45.1 STK",
          avatar: "/avatars/avatar-10.jpg",
        }
      ]);
      setIsLoading(false);
    }, 2000);
  }, []);

  return (
    <section className="py-20 overflow-hidden relative">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center mb-16">
          <div className="inline-block relative">
            <h2 className="text-4xl font-bold text-center text-white tracking-wider font-display">
              Top Sellers
            </h2>
            <div className="absolute -bottom-3 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
            <div className="absolute -bottom-5 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {isLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <SellerSkeleton key={index} />
              ))
            : sellers?.map((seller) => (
                <div
                  key={seller.id}
                  className={`relative rounded-xl overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
                    seller.highlight
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30'
                      : 'bg-gradient-to-r from-gray-900/80 to-gray-800/80 border border-gray-700/50'
                  }`}
                >
                  <div className="flex items-center p-4 gap-3">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white/20">
                      {/* <Image
                        src={seller.avatar}
                        alt={seller.name}
                        fill
                        className="object-cover"
                      /> */}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">
                        {seller.name}
                      </h3>
                      <p
                        className={`text-xs font-medium ${
                          seller.highlight ? 'text-blue-400' : 'text-purple-400'
                        }`}
                      >
                        {seller.amount}
                      </p>
                    </div>
                  </div>

                  {/* Hover effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  {/* Top accent line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                </div>
              ))}
        </div>
      </div>

      {/* Section divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
    </section>
  );
};

export default TopSellersSection;

