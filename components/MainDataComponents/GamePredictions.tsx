// components/GamePredictions.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

export default function GamePredictions() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uniqueDates, setUniqueDates] = useState<string[]>([]);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/game_predictions');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch predictions');
      }
      const data = await response.json();
      
      // Validate the received data
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format: expected an array');
      }
      if (data.length === 0) {
        setError('No upcoming games found. Check back later for new predictions.');
        setPredictions([]);
        setUniqueDates([]);
        return;
      }
      const validPredictions = data.filter(prediction => {
        return (
          prediction.gamePk &&
          prediction.gameDate &&
          prediction.homeTeam?.id &&
          prediction.homeTeam?.name &&
          prediction.awayTeam?.id &&
          prediction.awayTeam?.name &&
          typeof prediction.predictedWinner === 'number'
        );
      });

      if (validPredictions.length === 0) {
        throw new Error('No valid predictions found in the response');
      }
      // Extract unique dates and sort them
      const dates = [...new Set(validPredictions.map(game => game.gameDate))].sort();
      setUniqueDates(dates);
      
      // Set the first date as selected by default if none is selected
      if (!selectedDate || !dates.includes(selectedDate)) {
        setSelectedDate(dates[0]);
      }
      
      setPredictions(validPredictions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching predictions');
      console.error('Prediction error:', err);
      setPredictions([]);
      setUniqueDates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, []);

  const filteredPredictions = selectedDate
    ? predictions.filter(pred => pred.gameDate === selectedDate)
    : predictions;

  if (loading) {
    return (
      <Card className="w-full  ">
        <CardHeader>
          <CardTitle>Game Predictions</CardTitle>
          <CardDescription>Loading predictions...</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Game Predictions</CardTitle>
          <CardDescription className="text-red-500">{error}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={fetchPredictions}
            disabled={loading}
          >
            Try Again
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (predictions.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Game Predictions</CardTitle>
          <CardDescription>No predictions available at this time. Check back later.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={fetchPredictions}
            disabled={loading}
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
        <CardTitle>Game Predictions</CardTitle>
        <CardDescription>AI-powered predictions for upcoming games</CardDescription>
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
                  {new Date(date).toLocaleDateString('en-US', {
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
          className="w-full px-2"
        >
          <CarouselContent>
            {filteredPredictions.map((prediction, index) => (
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
        <Button 
          variant="outline" 
          className="w-100 m-auto" 
          onClick={fetchPredictions}
          disabled={loading}
        >
          Refresh Predictions
        </Button>
      </CardFooter>
    </Card>
  );
}