"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center p-6">
      <div className="text-center space-y-3 max-w-sm">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <WifiOff className="w-6 h-6 text-zinc-400" />
        </div>
        <h1 className="text-lg font-bold text-white">You&apos;re offline</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Your saved guides are stored on this device and still work. Connect
          to the internet to sync new content from the server.
        </p>
        <button
          onClick={() => navigator.onLine && window.location.reload()}
          className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
