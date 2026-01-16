"use client";

import React from "react";
// import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import Lottie from "lottie-react";
import animationData from "@/public/animations/Page Not Found 404 c3.json";

const LottiePlayer = () => {
  return <Lottie animationData={animationData} loop autoplay />;
};

export default LottiePlayer;
