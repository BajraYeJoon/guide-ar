import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-amber-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 00-7.072 0m7.072 0l2.829 2.829M12 2v2m0 16v2m-8-10H2m20 0h-2M6.343 6.343l1.414 1.414m7.072 7.072l2.829 2.829M6.343 17.657l1.414-1.414m7.072-7.072l2.829-2.829"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold mb-2">You&apos;re Offline</h1>
      <p className="text-zinc-400 mb-6 max-w-md">
        No internet connection detected. Some features require an online connection to work properly.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
