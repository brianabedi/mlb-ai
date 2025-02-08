import { NextResponse } from 'next/server';

interface ContentItem {
  slug: string;
  content_type: string;
  headline: string;
  url: string;
}

interface ContentInteraction {
  slug: string;
  content_type: string;
  content_headline: string;
}

async function fetchMLBContent(): Promise<ContentItem[]> {
  try {
    // Fetch the content interaction data from MLB's dataset
    const response = await fetch(
      'https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/mlb-fan-content-interaction-data/mlb-fan-content-interaction-data-000000000000.json',
      {
        headers: {
          'Accept-Encoding': 'gzip',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch content data: ${response.status}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const contentMap = new Map<string, { 
      slug: string;
      content_type: string;
      headline: string;
      interactions: number;
    }>();

    let buffer = '';
    
    // Process the file in chunks
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Convert the chunk to text and add to buffer
      buffer += new TextDecoder().decode(value);
      
      // Process complete lines from the buffer
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const item = JSON.parse(line) as ContentInteraction;
          
          if (item.content_type !== 'article' && item.content_type !== 'video') continue;
          
          const key = `${item.slug}-${item.content_type}`;
          
          if (!contentMap.has(key)) {
            contentMap.set(key, {
              slug: item.slug,
              content_type: item.content_type,
              headline: item.content_headline,
              interactions: 1
            });
          } else {
            contentMap.get(key)!.interactions += 1;
          }
          
          // Keep only top 20 items to save memory
          if (contentMap.size > 20) {
            const sortedEntries = Array.from(contentMap.entries())
              .sort(([, a], [, b]) => b.interactions - a.interactions)
              .slice(0, 10);
            contentMap.clear();
            sortedEntries.forEach(([k, v]) => contentMap.set(k, v));
          }
        } catch (e) {
          console.error('Error parsing line:', e);
          continue;
        }
      }
    }

    // Convert final results to array and sort
    const sortedContent = Array.from(contentMap.values())
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 10)
      .map(item => ({
        slug: item.slug,
        content_type: item.content_type,
        headline: item.headline,
        url: `https://www.mlb.com/${item.content_type === 'article' ? 'news' : 'video'}/${item.slug}`
      }));

    return sortedContent;

  } catch (error) {
    console.error('Error fetching MLB content:', error);
    
    return [
      {
        slug: 'mlb-live-games',
        content_type: 'article',
        headline: 'Today\'s MLB Games',
        url: 'https://www.mlb.com/scores'
      },
      {
        slug: 'mlb-standings',
        content_type: 'article',
        headline: 'Current MLB Standings',
        url: 'https://www.mlb.com/standings'
      }
    ];
  }
}


export async function GET() {
  const content = await fetchMLBContent();
  return NextResponse.json(content);
}