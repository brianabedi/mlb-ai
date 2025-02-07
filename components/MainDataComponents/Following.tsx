import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
  } from "@/components/ui/carousel"
export default function Following() {
  return (
    <Card className="w-full sm:col-span-1 col-span-2">
      <CardHeader>
        <CardTitle>Following</CardTitle>
        <CardDescription></CardDescription>
      </CardHeader>
      <CardContent>
    
      </CardContent>
      <CardFooter className="flex justify-between">

      </CardFooter>
    </Card>
  )
}
