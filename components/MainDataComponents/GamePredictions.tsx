"use client"
import React, { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// Sample game predictions
const SAMPLE_PREDICTIONS = [
  {
    homeTeam: { id: 119, name: "Dodgers" },
    awayTeam: { id: 137, name: "Giants" },
    predictedWinner: 119
  },
  {
    homeTeam: { id: 144, name: "Braves" },
    awayTeam: { id: 121, name: "Mets" },
    predictedWinner: 144
  },
  {
    homeTeam: { id: 147, name: "Yankees" },
    awayTeam: { id: 111, name: "Red Sox" },
    predictedWinner: 147
  },
  {
    homeTeam: { id: 143, name: "Cubs" },
    awayTeam: { id: 158, name: "Brewers" },
    predictedWinner: 158
  },
  {
    homeTeam: { id: 117, name: "Astros" },
    awayTeam: { id: 140, name: "Rangers" },
    predictedWinner: 117
  }
];

export default function GamePredictions() {
  const [predictions, setPredictions] = useState(SAMPLE_PREDICTIONS);

  return (
    <Card className="w-full sm:col-span-2">
      <CardHeader>
        <CardTitle>Today's Game Predictions</CardTitle>
        <CardDescription>AI-powered predictions for upcoming games</CardDescription>
      </CardHeader>
      <CardContent>
        <Carousel
          opts={{
            align: "start",
          }}
          className="w-full"
        >
          <CarouselContent>
            {predictions.map((prediction, index) => (
              <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/2">
                <div className="p-1">
                  <Card>
                    <CardContent className="flex items-center justify-between p-6">
                      <div className="flex flex-col items-center space-y-2">
                        <img
                          src={`https://www.mlbstatic.com/team-logos/${prediction.awayTeam.id}.svg`}
                          alt={prediction.awayTeam.name}
                          className="w-16 h-16"
                        />
                        <span className="text-sm font-medium">{prediction.awayTeam.name}</span>
                        {prediction.predictedWinner === prediction.awayTeam.id && (
                          <div className="flex items-center text-green-500">
                            <Check size={16} className="mr-1" />
                            <span className="text-xs">Predicted Winner</span>
                          </div>
                        )}
                      </div>
                      <span className="text-2xl font-bold mx-4">VS</span>
                      <div className="flex flex-col items-center space-y-2">
                        <img
                          src={`https://www.mlbstatic.com/team-logos/${prediction.homeTeam.id}.svg`}
                          alt={prediction.homeTeam.name}
                          className="w-16 h-16"
                        />
                        <span className="text-sm font-medium">{prediction.homeTeam.name}</span>
                        {prediction.predictedWinner === prediction.homeTeam.id && (
                          <div className="flex items-center text-green-500">
                            <Check size={16} className="mr-1" />
                            <span className="text-xs">Predicted Winner</span>
                          </div>
                        )}
                      </div>
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
        <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
          Refresh Predictions
        </Button>
      </CardFooter>
    </Card>
  );
}