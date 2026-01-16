"use client";
import { MainHero } from "@/components/main-hero";
import dynamic from "next/dynamic";
import ErrorBoundary from "@/components/ErrorBoundary";
import TopSellersSkeleton from "@/components/Skeleton/TopSellersSkeleton";
import ExploreCategoriesSkeleton from "@/components/Skeleton/ExploreCategoriesSkeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useEffect, useRef, useState } from "react";
import PopularThisWeekSkeleton from "@/components/Skeleton/PopluarThisWeekSkeleton";
// import PopularThisWeekMarqueeParent from "@/components/PopularThisWeekMarqueeParent";
// import PopularCollection from '@/components/PopularCollection';

const PopularThisWeek = dynamic<{}>(
  () => import("@/components/PopularThisWeekMarqueeParent"),
  {
    loading: () => <PopularThisWeekSkeleton />,
    ssr: false,
  }
);

// Repeat similar patterns for TopSellers and ExploreCategories
const TopSellers = dynamic(
  () => import("@/components/top-sellers").then((mod) => mod.TopSellers),
  {
    loading: () => <TopSellersSkeleton />,
    ssr: false,
  }
);

const ExploreCategories = dynamic<{}>(
  () => import("@/components/explore-categories"),
  {
    loading: () => <ExploreCategoriesSkeleton />,
    ssr: false,
  }
);

export default function Home() {
  const [showComponentOne, setShowComponentOne] = useState(false);
  const [showComponentTwo, setShowComponentTwo] = useState(false);
  const [showComponentThree, setShowComponentThree] = useState(false);

  const refOne = useRef<HTMLDivElement>(null);
  const refTwo = useRef<HTMLDivElement>(null);
  const refThree = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("useEffect");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === refOne.current) setShowComponentOne(true);
            if (entry.target === refTwo.current) setShowComponentTwo(true);
            if (entry.target === refThree.current) setShowComponentThree(true);
          }
        });
      },
      { threshold: 0.7 } // Trigger when 70% is visible
    );

    const listOfEnteries: (HTMLDivElement | null)[] = [
      refOne.current,
      refTwo.current,
      refThree.current,
    ];

    listOfEnteries.forEach((entry) => {
      if (entry) {
        observer.observe(entry);
      }
    });

    return () => observer.disconnect();
  }, [refOne.current, refTwo.current, refThree.current]);

  return (
    <div className="relative z-10 max-w-screen-xl mx-auto px-2 sm:px-4 md:px-8 lg:px-12 py-8 space-y-16">
      <MainHero />
      <div ref={refOne} className="min-h-[400px]">
        {showComponentOne && (
          <ErrorBoundary>
            <PopularThisWeek />
          </ErrorBoundary>
        )}
      </div>
      <div ref={refTwo} className="min-h-[400px]">
        {showComponentTwo && (
          <ErrorBoundary>
            <TopSellers />
          </ErrorBoundary>
        )}
      </div>
      <div ref={refThree} className="min-h-[400px]">
        {showComponentThree && (
          <ErrorBoundary>
            <ExploreCategories />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
