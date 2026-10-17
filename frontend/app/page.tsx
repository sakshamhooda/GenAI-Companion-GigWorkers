import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="text-5xl font-extrabold text-emerald-800 dark:text-emerald-400">साथी</p>
        <p className="mt-1 text-xl font-semibold">Saathi</p>
        <p lang="hi" className="mt-4 text-base">
          कमाई, अधिकार, सुरक्षा और शिकायत में आपका साथी। आपकी भाषा में।
        </p>
        <p lang="en" className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Your companion for earnings, rights, safety and complaints. In your language.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Link
          href="/login"
          className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 text-base font-semibold text-white hover:bg-emerald-800"
        >
          Login / लॉगिन
        </Link>
        <Link
          href="/register"
          className="flex min-h-12 items-center justify-center rounded-xl border border-zinc-300 bg-white text-base font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          Register / नया खाता
        </Link>
      </div>
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        Demo login: phone <strong>9999999999</strong>, PIN <strong>1234</strong>
      </p>
    </main>
  );
}
