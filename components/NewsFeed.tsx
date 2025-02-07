"use client"
import React, { useEffect, useState } from 'react';

interface ContentItem {
  slug: string;
  content_type: string;
  headline: string;
  url: string;
}

const NewsFeed = () => {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch('/api/articles');
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        const data: ContentItem[] = await response.json();
        if (data && Array.isArray(data) && data.length > 0) {
          setContent(data);
          setError(null);
        } else {
          setError('No content available');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch content');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
    
    // Refresh content every 5 minutes
    const intervalId = setInterval(fetchContent, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  const handleContentClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className=" h-12 mb-8 flex items-center justify-center">
        <p className="text-blue-400">Loading MLB updates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-12 mb-8 flex items-center justify-center">
        <p className="text-blue-400">Unable to load updates</p>
      </div>
    );
  }

  return (
    <div className=" h-12 mb-8 overflow-hidden relative">
      <div className="absolute whitespace-nowrap animate-ticker flex items-center h-full">
        {[...content, ...content].map((item, index) => (
          <button
            key={`${item.slug}-${index}`}
            onClick={() => handleContentClick(item.url)}
            className="inline-flex items-center px-4 text-black hover:text-blue-400 transition-colors cursor-pointer"
          >

            <span className="mr-2">
              {item.content_type === 'video' ? (
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12V8l4 2-4 2z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
                </svg>
              )}
            </span>
            
            <span>{item.headline}</span>
            
            <span className="mx-8 text-gray-500">|</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default NewsFeed;