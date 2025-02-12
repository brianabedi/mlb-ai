// utils/perspective.ts
import { google } from 'googleapis';

const DISCOVERY_URL = 'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1';

export async function analyzeToxicity(text) {
  try {
    const client = await google.discoverAPI(DISCOVERY_URL);
    
    const analyzeRequest = {
      comment: {
        text: text,
      }, languages: ["en"],
      requestedAttributes: {
        TOXICITY: {},
        SEVERE_TOXICITY: {},
        IDENTITY_ATTACK: {},
        INSULT: {},
        PROFANITY: {},
        THREAT: {}
      }
    };

    const response = await client.comments.analyze({
      key: process.env.GOOGLE_API_KEY,
      requestBody: analyzeRequest,
    }, 
    (err, response) => {
      if (err) throw err;
      console.log(JSON.stringify(response.data, null, 2));
    });

    if (!response.data.attributeScores) {
      throw new Error('No scores returned from Perspective API');
    }

    return {
      toxicity: response.data.attributeScores.TOXICITY.summaryScore.value,
      severeToxicity: response.data.attributeScores.SEVERE_TOXICITY.summaryScore.value,
      identityAttack: response.data.attributeScores.IDENTITY_ATTACK.summaryScore.value,
      insult: response.data.attributeScores.INSULT.summaryScore.value,
      profanity: response.data.attributeScores.PROFANITY.summaryScore.value,
      threat: response.data.attributeScores.THREAT.summaryScore.value
    };
  } catch (error) {
    console.error('Perspective API error:', error);
    throw error;
  }
}