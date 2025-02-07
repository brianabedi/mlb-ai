import { NextResponse } from 'next/server';

interface ContentItem {
  slug: string;
  content_type: string;
  headline: string;
  url: string;
}

async function fetchMLBContent(): Promise<ContentItem[]> {
  try {
    // Fetch the content interaction data from MLB's dataset
    const response = await fetch('https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/mlb-fan-content-interaction-data/mlb-fan-content-interaction-data-000000000000.json');

    if (!response.ok) {
      throw new Error(`Failed to fetch content data: ${response.status}`);
    }

    const text = await response.text();
    // Parse the newline-delimited JSON
    const items = text.trim().split('\n')
      .map(line => JSON.parse(line))
      .filter(item => item.content_type === 'article' || item.content_type === 'video');

    // Group by slug and count interactions
    const contentMap = new Map();
    items.forEach(item => {
      const key = `${item.slug}-${item.content_type}`;
      if (!contentMap.has(key)) {
        contentMap.set(key, {
          slug: item.slug,
          content_type: item.content_type,
          headline: item.content_headline,
          interactions: 1
        });
      } else {
        contentMap.get(key).interactions += 1;
      }
    });

    // Convert to array and sort by interactions
    const sortedContent = Array.from(contentMap.values())
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 10) // Get top 10 most interacted content
      .map(item => ({
        slug: item.slug,
        content_type: item.content_type,
        headline: item.headline,
        url: `https://www.mlb.com/${item.content_type === 'article' ? 'news' : 'video'}/${item.slug}`
      }));

    return sortedContent;

  } catch (error) {
    console.error('Error fetching MLB content:', error);
    
    // Return fallback content
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