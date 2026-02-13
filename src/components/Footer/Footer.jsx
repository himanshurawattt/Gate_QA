import React, { useState } from 'react';
import DataPolicyModal from './DataPolicyModal';
import SupportModal from './SupportModal';
import { FaHeart, FaExclamationTriangle } from 'react-icons/fa';

const Footer = () => {
  const [isDataPolicyOpen, setIsDataPolicyOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

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
              Question database powered by <a href="https://gateoverflow.in/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">GATE Overflow</a> © 2014-2025.
            </p>

            {/* Data Policy Link - Made Prominent */}
            <button
              onClick={() => setIsDataPolicyOpen(true)}
              className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-black text-xs font-semibold rounded border border-red-500 dark:border-red-500 transition-colors"
            >
              <FaExclamationTriangle className="text-red-600 dark:text-red-400" />
              <span>Read This: Data Persistence & Policy</span>
            </button>
          </div>

          {/* Support Section */}
          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <button
              onClick={() => setIsSupportOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 dark:bg-white dark:hover:bg-gray-100 backdrop-blur-md border border-gray-200 dark:border-gray-200 text-black dark:text-black text-base font-semibold rounded-full shadow-lg hover:shadow-xl transition-all group"
              aria-label="Support me"
            >
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                Support Me
              </span>
              <FaHeart className="text-xl text-red-500 animate-pulse group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </footer>

      {/* Data Policy Modal */}
      <DataPolicyModal
        isOpen={isDataPolicyOpen}
        onClose={() => setIsDataPolicyOpen(false)}
      />

      {/* Support Modal */}
      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />

      {/* Data Policy Modal */}
      <DataPolicyModal
        isOpen={isDataPolicyOpen}
        onClose={() => setIsDataPolicyOpen(false)}
      />
    </>
  );
};

export default Footer;
