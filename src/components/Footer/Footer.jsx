import React, { useState } from 'react';
import DataPolicyModal from './DataPolicyModal';

const Footer = () => {
  const [isDataPolicyOpen, setIsDataPolicyOpen] = useState(false);

  // Current year or fixed year range as requested "2014-2025" (User mentioned dynamic or fixed, keeping fixed per specific text request, or dynamic end year to be safe? User text: "2014-2025". I will use dynamic end year to be smart about it, or revert to static if strict.)
  // User Text Requirement: "Copyright © GATE Overflow 2014-2025."
  // I will stick to the static text for now to be precise, or use dynamic if I want to be proactive. 
  // Let's use 2025 as requested in the text block.

  return (
    <>
      <footer className="w-full bg-gray-50 border-t border-gray-200 py-8 px-4 sm:px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-6">

          {/* Copyright & Attribution Section */}
          <div className="flex-1 max-w-3xl">
            <p className="text-sm text-gray-800 mb-2">
              All questions sourced from and credited to <a href="https://gateoverflow.in/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">GATE Overflow</a> © 2014-2025.
            </p>

            {/* Data Policy Link */}
            <button
              onClick={() => setIsDataPolicyOpen(true)}
              className="text-xs text-gray-500 hover:text-gray-700 underline decoration-dotted underline-offset-2 transition-colors"
            >
              Important: Data Persistence & Policy
            </button>
          </div>
        </div>
      </footer>

      {/* Data Policy Modal */}
      <DataPolicyModal
        isOpen={isDataPolicyOpen}
        onClose={() => setIsDataPolicyOpen(false)}
      />
    </>
  );
};

export default Footer;
