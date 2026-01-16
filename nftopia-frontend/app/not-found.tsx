"use client";

import LottiePlayer from "@/components/animations/LottiePlayer";
import Link from "next/link";
import React from "react";
import { useMobile } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import Footer from "@/components/Footer";
import { CircuitBackground } from "@/components/circuit-background";
import { StarknetProvider } from "@/components/StarknetProvider";
import { StoreProvider } from "@/lib/stores/store-provider";
import { Toast } from "@/components/ui/toast";
import { useTranslation } from "@/hooks/useTranslation";

const NotFound = () => {
  const isMobile = useMobile();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0c38] via-[#181359] to-[#241970] text-white relative contain-layout">
      <StoreProvider>
        <StarknetProvider>
          <main className="relative z-10 pt-16 md:pt-20">
            <Navbar />
            <CircuitBackground />
            <div className="container-responsive py-4 md:py-8">
              <div
                className={`flex items-center justify-center min-h-[60vh] w-full px-4 py-12 ${
                  isMobile ? "flex-col space-y-8" : "flex-row space-x-8"
                }`}
              >
                <div
                  className={`flex flex-col ${
                    isMobile
                      ? "items-center text-center space-y-4"
                      : "space-y-3 max-w-md items-start text-left"
                  }`}
                >
                  <h1
                    className={
                      isMobile
                        ? "text-4xl font-bold mt-5 text-white"
                        : "text-6xl mt-5 font-bold text-white"
                    }
                  >
                    {t("notFound.title")}
                  </h1>
                  <p
                    className={`${
                      isMobile ? "text-lg" : "text-2xl"
                    } text-white`}
                  >
                    {t("notFound.message")}
                  </p>
                  <p
                    className={`${
                      isMobile ? "text-lg" : "text-2xl"
                    } text-white`}
                  >
                    {t("notFound.errorCode")}
                  </p>
                  <Link href="/en">
                    <Button
                      size={isMobile ? "sm" : "lg"}
                      className="rounded-xl bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white mt-2"
                    >
                      {t("notFound.backToHome")}
                    </Button>
                  </Link>
                </div>
                <div
                  className={
                    isMobile ? "w-full max-w-2xl mt-8" : "w-[740px] ml-8"
                  }
                >
                  <LottiePlayer />
                </div>
              </div>
            </div>
            <Footer />
          </main>
          <Toast />
        </StarknetProvider>
      </StoreProvider>
    </div>
  );
};

export default NotFound;
