import Image from "next/image";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center
     min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
          <header className="row-start-1 w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/mlbai.png"
            alt="Logo"
            width={34}
            height={24}
            // className="dark:invert"
          />
          <span className="font-semibold">MLB AI</span>
        </div>
        {/* <nav className="hidden sm:flex items-center gap-4">
          <a href="#" className="hover:text-gray-600 dark:hover:text-gray-300">Home</a>
          <a href="#" className="hover:text-gray-600 dark:hover:text-gray-300">About</a>
          <a href="#" className="hover:text-gray-600 dark:hover:text-gray-300">Contact</a>
        </nav> */}
      <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
        <Image
              className="dark:invert"
              src="/login.png"
              alt="loginsignupimage"
              width={24}
              height={24}
            />
          {/* Login / Signup */}
          </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 mr-20">
        <div className="grid gap-4">
          <div className="space-y-2">
            {/* <h4 className="font-medium leading-none">Dimensions</h4> */}
            {/* <p className="text-sm text-muted-foreground text-blue-600  ">
              Sign Up
            </p> */}
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="width">Email</Label>
              <Input
                id="width"
                placeholder="name@gmail.com"


                className="col-span-2 h-8"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="maxWidth">Password</Label>
              <Input
                id="maxWidth"
                placeholder="*****"
                className="col-span-2 h-8"
              />
            </div>
        

           
          </div>
              <Button variant="outline"
            className="bg-black text-white font-bold width-10 width-100">
              Login | Signup 
              </Button>
        </div>
      </PopoverContent>
    </Popover>

      </header>
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
      
        <ol className="list-inside list-decimal text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
          <li className="mb-2">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-semibold">
              app/page.tsx
            </code>
            .
          </li>
          <li>Save and see your changes instantly.</li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
