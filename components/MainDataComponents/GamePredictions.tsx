// components/GamePredictions.tsx
"use client"
import React, { useState } from "react";
import useSWR from "swr";
import { Check, TrendingUpDown } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Prediction {
  gamePk: string;
  gameDate: string;
  homeTeam: {
    id: number;
    name: string;
  };
  awayTeam: {
    id: number;
    name: string;
  };
  predictedWinner: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Please wait before refreshing again. The prediction service is rate-limited to prevent overuse.');
    }
    throw new Error('Failed to fetch predictions');
  }
  const data = await res.json();
  
  // Validate the received data
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format: expected an array');
  }
  
  return data;
};

export default function GamePredictions() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  
  const { data: predictions, error, isLoading, mutate } = useSWR<Prediction[]>(
    '/api/game_predictions',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
      dedupingInterval: 60 * 1000, // Dedupe requests within 1 minute
      onSuccess: (data) => {
        // Set initial selected date if not set
        if (!selectedDate && data && data.length > 0) {
          const dates = [...new Set(data.map(game => game.gameDate))].sort();
          setSelectedDate(dates[0]);
        }
      }
    }
  );

  // Get unique dates from predictions
  const uniqueDates = React.useMemo(() => {
    if (!predictions) return [];
    return [...new Set(predictions.map(game => game.gameDate))].sort();
  }, [predictions]);

  // Filter predictions by selected date
  const filteredPredictions = React.useMemo(() => {
    if (!predictions) return [];
    return selectedDate
      ? predictions.filter(pred => pred.gameDate === selectedDate)
      : predictions;
  }, [predictions, selectedDate]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpDown className="h-6 w-6" />
            AI Game Predictions
          </CardTitle>
          <CardDescription>AI powered predictions for upcoming games</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <div className="w-8 h-8 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpDown className="h-6 w-6" />
            AI Game Predictions
          </CardTitle>
          <CardDescription>AI powered predictions for upcoming games</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => mutate()}
            disabled={isLoading}
          >
            Try Again
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!predictions || predictions.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpDown className="h-6 w-6" />
            AI Game Predictions
          </CardTitle>
          <CardDescription>AI powered predictions for upcoming games</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>No upcoming games found. Check back later for new predictions.</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => mutate()}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUpDown className="h-6 w-6" />
          AI Game Predictions
        </CardTitle>
        <CardDescription>AI powered predictions for upcoming games</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <Select
            value={selectedDate}
            onValueChange={setSelectedDate}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select date" />
            </SelectTrigger>
            <SelectContent>
              {uniqueDates.map(date => (
                <SelectItem key={date} value={date}>
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Carousel
          opts={{
            align: "start",
          }}
          className="w-full px-8"
        >
          <CarouselContent>
            {filteredPredictions.map((prediction, index) => (
              <CarouselItem key={index} className="md:basis-1/2">
                <div>
                  <Card>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex flex-col items-center space-y-2">
                        <img
                          src={`https://www.mlbstatic.com/team-logos/${prediction.awayTeam.id}.svg`}
                          alt={prediction.awayTeam.name}
                          className="md:w-16 md:h-16 w-8 h-8"
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
                          className="md:w-16 md:h-16 w-8 h-8"
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
    </Card>
  );
}