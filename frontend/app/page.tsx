import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-3xl rounded-lg bg-white p-12 shadow-sm dark:bg-neutral-900">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50">
            Welcome to Epilink System
          </h1>
          <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
            This is a custom landing page. Use the links below to navigate your app.
          </p>
        </header>

        <section className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/dashboard"
            className="flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
          >
            Go to Dashboard
          </Link>

          <Link
            href="/health"
            className="flex items-center justify-center rounded-full border border-gray-200 px-6 py-3 text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-neutral-800"
          >
            Health Check
          </Link>

          <a
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-full border border-gray-200 px-6 py-3 text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-neutral-800"
          >
            Next.js Docs
          </a>
        </section>
      </main>
    </div>
  );
}
