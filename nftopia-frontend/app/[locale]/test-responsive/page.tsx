"use client";

import React from "react";

export default function TestResponsivePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0c38] via-[#181359] to-[#241970] text-white">
      <div className="container-responsive py-8">
        <h1 className="text-responsive-xl font-bold text-center mb-8">
          Responsive Design Test
        </h1>

        {/* Breakpoint Indicators */}
        <div className="grid-responsive mb-8">
          <div className="card-responsive">
            <h3 className="text-responsive-lg font-semibold mb-4">Mobile</h3>
            <p className="text-responsive text-gray-300">
              This should be visible on mobile devices (&lt;576px)
            </p>
            <div className="mt-4 p-3 bg-purple-500/20 rounded-lg">
              <p className="text-sm">Mobile breakpoint: &lt;576px</p>
            </div>
          </div>

          <div className="card-responsive">
            <h3 className="text-responsive-lg font-semibold mb-4">Tablet</h3>
            <p className="text-responsive text-gray-300">
              This should be visible on tablet devices (576px-991px)
            </p>
            <div className="mt-4 p-3 bg-purple-500/20 rounded-lg">
              <p className="text-sm">Tablet breakpoint: 576px-991px</p>
            </div>
          </div>

          <div className="card-responsive">
            <h3 className="text-responsive-lg font-semibold mb-4">Desktop</h3>
            <p className="text-responsive text-gray-300">
              This should be visible on desktop devices (&gt;992px)
            </p>
            <div className="mt-4 p-3 bg-purple-500/20 rounded-lg">
              <p className="text-sm">Desktop breakpoint: &gt;992px</p>
            </div>
          </div>
        </div>

        {/* Responsive Grid Test */}
        <div className="mb-8">
          <h2 className="text-responsive-lg font-semibold mb-6">
            Grid System Test
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="card-responsive">
                <h4 className="font-semibold mb-2">Card {i + 1}</h4>
                <p className="text-responsive text-gray-300">
                  This card demonstrates responsive grid behavior.
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Touch Target Test */}
        <div className="mb-8">
          <h2 className="text-responsive-lg font-semibold mb-6">
            Touch Target Test
          </h2>
          <div className="flex flex-wrap gap-4">
            <button className="touch-target px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
              Button 1
            </button>
            <button className="touch-target px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
              Button 2
            </button>
            <button className="touch-target px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
              Button 3
            </button>
          </div>
        </div>

        {/* Responsive Text Test */}
        <div className="mb-8">
          <h2 className="text-responsive-lg font-semibold mb-6">
            Responsive Text Test
          </h2>
          <div className="space-y-4">
            <p className="text-responsive">
              This is responsive text that scales with screen size.
            </p>
            <p className="text-responsive-lg">
              This is larger responsive text for better readability.
            </p>
            <p className="text-responsive-xl">
              This is extra large responsive text for headings.
            </p>
          </div>
        </div>

        {/* Container Test */}
        <div className="mb-8">
          <h2 className="text-responsive-lg font-semibold mb-6">
            Container Test
          </h2>
          <div className="container-responsive bg-purple-500/10 rounded-lg p-6">
            <p className="text-responsive text-center">
              This container should have proper padding and max-width
              constraints.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
