import Image from "next/image";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
import AuthPopover from "@/components/AuthPopover";

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
   
   <AuthPopover />
      </header>
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
 

 
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
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Created by Brian Abedi
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
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
          Terms
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
          Privacy
        </a>
      </footer>
    </div>
  );
}
