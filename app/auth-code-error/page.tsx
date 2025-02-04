// app/auth-code-error/page.tsx
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
        <div className="mb-6 text-gray-600 space-y-2">
          <p>There was an error verifying your email. This might happen if:</p>
          <ul className="list-disc text-left pl-4 space-y-1">
            <li>The verification link has expired</li>
            <li>The link was already used</li>
            <li>The link was malformed</li>
          </ul>
        </div>
        <Button asChild>
          <Link href="/">
            Return Home
          </Link>
        </Button>
      </div>
    </div>
  );
}