import React from "react";

export default function LiveFaceVerificationPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-4">Live Face Verification</h1>
      <p className="mb-6 text-slate-700">
        Capture your live face to set your reference vector. This vector will be used to verify your identity and prevent unauthorized photo searches.
      </p>
      {/* TODO: Add webcam capture and vector API integration here */}
      <div className="rounded-lg border border-slate-200 p-6 bg-white shadow">
        <p className="text-slate-500">Face capture and vector management UI coming soon.</p>
      </div>
    </div>
  );
}
