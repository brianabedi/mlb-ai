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
import { FileText, Clock, Image as ImageIcon } from "lucide-react";
import { createClient } from '@/utils/supabase/client';

interface Report {
  id: string;
  created_at: string;
  title: string;
  content: string;
  type: 'daily' | 'weekly';
  image_url?: string | null;

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
        const cleanedReports = data.map((report: Report) => ({
          ...report,
          content: report.content.replace(/^```html\n|```$/g, '')
        }));
        
        setReports(cleanedReports);
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
                    <TableHead>Image</TableHead>

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
                      <TableCell>
                        {report.image_url ? (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        ) : null}
                      </TableCell>
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
          <ScrollArea className="h-[70vh]">
            <div className="p-4 space-y-6">
              {selectedReport?.image_url && (
                <div className="relative w-full h-64 mb-6">
                  <img
                    src={selectedReport.image_url}
                    alt="Report visualization"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <a 
                    href="https://deepmind.google/technologies/imagen-3/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm hover:bg-black/70 transition-colors"
                  >
                   AI Generated (Imagen)
                  </a>
                </div>
              )}
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedReport?.content || '' }} 
              />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}