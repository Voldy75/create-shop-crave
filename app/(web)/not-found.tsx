import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white p-4 text-center">
      <p className="text-6xl font-extrabold text-indigo-600 mb-4">404</p>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h2>
      <p className="text-gray-500 mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/">
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 h-12">
          Go Home
        </Button>
      </Link>
    </main>
  );
}
