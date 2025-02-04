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
export default function GamePredictions() {
  return (
    <Card  className="w-full col-span-2">
      <CardHeader>
        <CardTitle>Game Predictions</CardTitle>
        <CardDescription></CardDescription>
      </CardHeader>
      <CardContent>
      <Carousel
      opts={{
        align: "start",
      }}
      className="w-full  "
    >
      <CarouselContent>
        {Array.from({ length: 5 }).map((_, index) => (
          <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/2">
            <div className="p-1">
              <Card>
                <CardContent className="flex items-center justify-center p-6">
                  <span className="text-3xl  font-semibold">placeholder</span>
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="ml-6" />
      <CarouselNext className="mr-6" />
    </Carousel>
      </CardContent>
      <CardFooter className="flex justify-between">
       
      </CardFooter>
    </Card>
  )
}
