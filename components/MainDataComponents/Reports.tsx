"use client"
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Clock } from "lucide-react";
import { createClient } from '@/utils/supabase/client';

interface Report {
  id: string;
  created_at: string;
  title: string;
  content: string;
  type: 'daily' | 'weekly';
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Please login to view reports');
          return;
        }

        const response = await fetch('/api/reports');
        if (!response.ok) throw new Error('Failed to fetch reports');
        
        const data = await response.json();
        setReports(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [supabase]);

  if (!loading && error) {
    return (
      <Card className="w-full mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Reports
          </CardTitle>
          <CardDescription>Daily and weekly performance reports</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center space-y-4 py-8">
      <Clock className="h-12 w-12 text-muted-foreground" />
      <div className="text-center space-y-2">
        <p className="text-muted-foreground">No reports available yet</p>
        <p className="text-sm text-muted-foreground">
          Follow teams and players to receive daily reports at 12pm
        </p>
      </div>
    </div>
  );

  return (
    <>
      <Card className="w-full mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Reports
          </CardTitle>
          <CardDescription>Daily and weekly performance reports</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <EmptyState />
          ) : (
            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow 
                      key={report.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedReport(report)}
                    >
                      <TableCell>
                        {new Date(report.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="capitalize">{report.type}</TableCell>
                      <TableCell>{report.title}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title}</DialogTitle>
            <DialogDescription>
              {new Date(selectedReport?.created_at || '').toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="p-4 space-y-4" dangerouslySetInnerHTML={{ __html: selectedReport?.content || '' }} />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}