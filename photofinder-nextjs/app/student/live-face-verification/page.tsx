"use client";

import React from "react";
import { Header } from "@/components/header";

export default function LiveFaceVerificationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header userRole="student" showLogout={true} />
      
      <div className="max-w-2xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold mb-4">Live Face Verification</h1>
        <p className="mb-6 text-slate-700">
          Capture your live face to set your reference vector. This vector will be used to verify your identity and prevent unauthorized photo searches.
        </p>
        
        {/* Important Notice */}
        <div className="rounded-lg border-l-4 border-l-amber-500 bg-amber-50 p-6 mb-8 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-900 mb-3">⚠️ Verification Required</h2>
          <p className="text-amber-800 mb-3">
            To use the photo search function, you <strong>must complete this live face verification test</strong>. This is required to ensure that the reference photos you use to search are actually photos of your own face, and to prevent unauthorized searches using other people's photos without permission.
          </p>
          <p className="text-sm text-amber-700">
            By completing this verification, you confirm that you are the person in the photos you will use for searching.
          </p>
        </div>

        {/* TODO: Add webcam capture and vector API integration here */}
        <div className="rounded-lg border border-slate-200 p-6 bg-white shadow">
          <div className="flex flex-col items-center gap-4">
            <p className="text-slate-600 text-center">Ready to get started? Click the button below to begin your live face verification.</p>
            <button className="px-8 py-3 bg-gradient-to-r from-primary to-primary/80 text-white font-semibold rounded-lg hover:shadow-lg hover:from-primary/90 hover:to-primary/70 transition-all duration-300">
              Start Live Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
