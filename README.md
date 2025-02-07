## MLB AI

Site can be accessed at [mlb-ai.com](https://mlb-ai.com).

### How to run locally

1. Create a `.env.local` file in the root of the project, then fill it with the following:
    ```
    GCP_API_KEY="Your_GCP_API_Key"
    GCP_LINK="Your_GCP_Link"
    SUPABASE_API_KEY="Your_Supabase_API_Key"
    SUPABASE_LINK="Your_Supabase_Link"
    ```

2. Install dependencies and run the development server:
    ```bash
    npm i --legacy-peer-deps
    npm run dev
    ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Features

- AI Powerd MLB Game Winner Predictions
- AI Generated Reports Daily on Followed Players & Teams
- News Feed, player & team rankings

### Technologies Used

- Next.js
- Supabase
- Gemini
- MLB StatsApi

### Contributing

1. Fork the repository
2. Create a new branch (`git checkout -b feature-branch`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature-branch`)
5. Create a new Pull Request

## Author

Created by [Brian Abedi](https://linkedin.com/in/brianabedi) for the Google MLB hackathon.
