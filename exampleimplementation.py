#@title Import Python Libraries
# General data science libraries
import pandas as pd
import numpy as np

# Pulling data from APIs, parsing JSON
import requests
import json

# Interfacing w/ Cloud Storage from Python
from google.cloud import storage

# Plotting
import matplotlib.pyplot as plt
import seaborn as sns

from IPython.display import HTML, Image
#@title Function to Load Newline Delimited JSON into Pandas DF
def load_newline_delimited_json(url):
    """Loads a newline-delimited JSON file from a URL into a pandas DataFrame.

    Args:
        url: The URL of the newline-delimited JSON file.

    Returns:
        A pandas DataFrame containing the data, or None if an error occurs.
    """
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for bad status codes

        data = []
        for line in response.text.strip().split('\n'):
            try:
                data.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"Skipping invalid JSON line: {line} due to error: {e}")

        return pd.DataFrame(data)
    except requests.exceptions.RequestException as e:
        print(f"Error downloading data: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None
    


    #@title Function to Process Results from Various MLB Stats API Endpoints
def process_endpoint_url(endpoint_url, pop_key=None):
  """
  Fetches data from a URL, parses JSON, and optionally pops a key.

  Args:
    endpoint_url: The URL to fetch data from.
    pop_key: The key to pop from the JSON data (optional, defaults to None).

  Returns:
    A pandas DataFrame containing the processed data
  """
  json_result = requests.get(endpoint_url).content

  data = json.loads(json_result)

   # if pop_key is provided, pop key and normalize nested fields
  if pop_key:
    df_result = pd.json_normalize(data.pop(pop_key), sep = '_')
  # if pop_key is not provided, normalize entire json
  else:
    df_result = pd.json_normalize(data)

  return df_result

#@title Sports (Different Baseball Leagues/Levels/Competitions)
sports_endpoint_url = 'https://statsapi.mlb.com/api/v1/sports'

sports = process_endpoint_url(sports_endpoint_url, 'sports')

display(sports)

#@title Leagues

# Can add "?sportId=1" to following URL for MLB only
leagues_endpoint_url = 'https://statsapi.mlb.com/api/v1/league'

leagues = process_endpoint_url(leagues_endpoint_url, 'leagues')

display(leagues)


#@title Seasons

# Use "?sportId=1" in following URL for MLB only
# Can also add "&withGameTypeDates=true" at end to get much more info on games
seasons_endpoint_url = 'https://statsapi.mlb.com/api/v1/seasons/all?sportId=1'

seasons = process_endpoint_url(seasons_endpoint_url, 'seasons')

display(seasons)



#@title Teams
# Use "?sportId=1" in following URL for MLB only
teams_endpoint_url = 'https://statsapi.mlb.com/api/v1/teams?sportId=1'

teams = process_endpoint_url(teams_endpoint_url, 'teams')

display(teams)


#@title Get Team Logo

# Pick single team ID to get logo for (default is 119 for Dodgers)
team_id = 119 # @param {type:"integer"}

# Get team logo using team_id
team_logo_url = f'https://www.mlbstatic.com/team-logos/{team_id}.svg'

# Display team logo (can change size if desired)
display(Image(url = team_logo_url, width=100, height=100))


#@title Single Team Roster

# Pick single team ID to get roster for (default is 119 for Dodgers)
team_id = 119 # @param {type:"integer"}

single_team_roster_url = f'https://statsapi.mlb.com/api/v1/teams/{team_id}/roster?season=2025'

single_team_roster = process_endpoint_url(single_team_roster_url, 'roster')

display(single_team_roster)

#@title All Players from 1 Season

# Pick single season to get all players for (default is 2024)
season = 2024 # @param {type:"integer"}

single_season_players_url = f'https://statsapi.mlb.com/api/v1/sports/1/players?season={season}'

players = process_endpoint_url(single_season_players_url, 'people')

display(players)

#@title Single Player Information
# Pick single player ID to get info for (default is 660271 for Shohei Ohtani)
player_id = 660271 # @param {type:"integer"}

single_player_url = f'https://statsapi.mlb.com/api/v1/people/{player_id}/'

single_player_info_json = json.loads(requests.get(single_player_url).content)

display(single_player_info_json)

#@title Get Player MLB.com Headshot

# Get current headshot for player using his player_id
player_current_headshot_url = f'https://securea.mlb.com/mlb/images/players/head_shot/{player_id}.jpg'

display(Image(url = player_current_headshot_url))

#@title Schedule / Games

# Pick single season to get schedule for (default is 2024)
season = 2024 # @param {type:"integer"}

# Can change season to get other seasons' games info
schedule_endpoint_url = f'https://statsapi.mlb.com/api/v1/schedule?sportId=1&season={season}'

schedule_dates = process_endpoint_url(schedule_endpoint_url, "dates")

games = pd.json_normalize(
    schedule_dates.explode('games').reset_index(drop = True)['games'])

display(games)

#@title Single Game Full Data

# Pick gamePK of last game from games data as default
game_pk = games['gamePk'].iloc[-1]

single_game_feed_url = f'https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live'

single_game_info_json = json.loads(requests.get(single_game_feed_url).content)

# Print the initial part of the JSON result (very large object with many fields)
display(json.dumps(single_game_info_json)[:1000])


#@title Single Play Information (from Game Data)
# Default to getting info on "current" (last) play from single game info above
single_game_play = single_game_info_json['liveData']['plays']['currentPlay']

display(single_game_play)

MLB Film Room gives fans incredible access to watch, create and share baseball highlights and videos from the game. The cell below shows how to take a single MLB playId from MLB Stats API (like the ones available in some of the outputs above) and then build a URL to find the video for that play on Film Room.


#@title Get MLB Film Room Video Link for Specific Play ID
# Pick single play ID to get info for (default is Freddie Freeman 2024 WS Gm1 walk-off grand slam)
play_id = "560a2f9b-9589-4e4b-95f5-2ef796334a94" # @param {type:"string"}

single_play_video_url = f'https://www.mlb.com/video/search?q=playid=\"{play_id}\"'

display(single_play_video_url)


# Exploring MLB Home Runs Data and Video
---
[The provided datasets](https://console.cloud.google.com/storage/browser/gcp-mlb-hackathon-2025/datasets) include 4 CSV files that have links to public video files for each home run hit during 3 different MLB seasons (including the most recent 2024 season, including playoffs), along with some basic information about every HR. These links can be used to watch video to help corroborate what's in the data for a specific HR, and also the video can serve as a basis for AI-driven analysis or recommendations.

#@title Get MLB Home Runs Data from Cloud Storage
mlb_hr_csvs_list = [
  'https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/2016-mlb-homeruns.csv',
  'https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/2017-mlb-homeruns.csv',
  'https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/2024-mlb-homeruns.csv',
  'https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/2024-postseason-mlb-homeruns.csv'
  ]

mlb_hrs = pd.DataFrame({'csv_file': mlb_hr_csvs_list})

# Extract season from the 'csv_file' column using regex
mlb_hrs['season'] = mlb_hrs['csv_file'].str.extract(r'/datasets/(\d{4})')

mlb_hrs['hr_data'] = mlb_hrs['csv_file'].apply(pd.read_csv)

for index, row in mlb_hrs.iterrows():
  hr_df = row['hr_data']
  hr_df['season'] = row['season']

all_mlb_hrs = (pd.concat(mlb_hrs['hr_data'].tolist(), ignore_index = True)
  [['season', 'play_id', 'title', 'ExitVelocity', 'LaunchAngle', 'HitDistance',
    'video']])

all_mlb_hrs

all_mlb_hrs

#@title See Single Home Run Video in Notebook

# Pick single HR play ID to get video for (default is Freddie Freeman 2024 WS Gm1 walk-off grand slam)
hr_play_id = "560a2f9b-9589-4e4b-95f5-2ef796334a94" # @param {type:"string"}

# Get video URL for specific play from MLB dataset
hr_video_url = all_mlb_hrs[all_mlb_hrs['play_id'] == hr_play_id]['video'].iloc[0]

HTML(f"""<video width="640" height="360" controls>
          <source src="{hr_video_url}" type="video/mp4">
          Your browser does not support the video tag.
        </video>""")


#@title Read in MLB Fan Favorites/Follows Data from Google Cloud Storage
mlb_fan_favorites_json_file = 'https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/mlb-fan-content-interaction-data/2025-mlb-fan-favs-follows.json'

mlb_fan_favorites_df = load_newline_delimited_json(mlb_fan_favorites_json_file)

# Convert favorite team ID to integer format
mlb_fan_favorites_df['favorite_team_id'] = (
  mlb_fan_favorites_df['favorite_team_id'].astype('Int64'))

display(mlb_fan_favorites_df.head())

#@title Look at Most Common Favorite MLB Teams
most_common_favorite_teams = (pd.merge(
  mlb_fan_favorites_df['favorite_team_id'].value_counts().reset_index().
    rename(columns = {"count": "num_favorites"}),
  teams[['id', 'name']].
    rename(columns = {"id": "team_id", "name": "team_name"}),
  left_on = 'favorite_team_id',
  right_on = 'team_id',
  how = 'left'
  )[['team_id', 'team_name', 'num_favorites']]
  )

# Create barplot showing most common favorite MLB teams
plt.figure(figsize=(12, 8))
sns.barplot(x='num_favorites', y='team_name', data=most_common_favorite_teams,
    orient='h', color='blue')
plt.title('Most Common Favorite MLB Teams')
plt.xlabel('Number of Favorites')
plt.ylabel('Team Name')

# Add text labels for # of favorites next to each bar
for index, row in most_common_favorite_teams.iterrows():
  plt.text(row['num_favorites'], index, str(row['num_favorites']),
    color='black', ha='left', va='center')

plt.show()
#@title Look at Most Followed MLB Teams

# Explode the 'followed_team_ids' column to create 1 row for each followed team
mlb_fan_follows_expanded_df = (mlb_fan_favorites_df.
  explode('followed_team_ids').
  reset_index(drop=True)
  )

# Convert followed team IDs to integer format
mlb_fan_follows_expanded_df['followed_team_ids'] = (
  mlb_fan_follows_expanded_df['followed_team_ids'].astype('Int64'))

most_followed_teams = (pd.merge(
  mlb_fan_follows_expanded_df['followed_team_ids'].value_counts().reset_index().
    rename(columns = {"count": "num_followers"}),
  teams[['id', 'name']].
    rename(columns = {"id": "team_id", "name": "team_name"}),
  left_on = 'followed_team_ids',
  right_on = 'team_id',
  how = 'left'
  )[['team_id', 'team_name', 'num_followers']]
  )

# Create barplot showing most followed MLB teams
plt.figure(figsize=(12, 8))
sns.barplot(x='num_followers', y='team_name', data=most_followed_teams,
    orient='h', color='blue')
plt.title('Most Followed MLB Teams')
plt.xlabel('Number of Followers')
plt.ylabel('Team Name')

# Add text labels for # of followers next to each bar
for index, row in most_followed_teams.iterrows():
  plt.text(row['num_followers'], index, str(row['num_followers']),
    color='black', ha='left', va='center')

plt.show()

#@title Look at Most Followed MLB Players

# Explode 'followed_player_ids' column to create 1 row for each followed player
mlb_fan_followed_players_expanded_df = (mlb_fan_favorites_df.
  explode('followed_player_ids').
  reset_index(drop=True)
  )

# Convert followed player IDs to integer format
mlb_fan_followed_players_expanded_df['followed_player_ids'] = (
  mlb_fan_followed_players_expanded_df['followed_player_ids'].astype('Int64'))

# Get list of Top N players by number of followers (including player names)
most_followed_players = (pd.merge(
  mlb_fan_followed_players_expanded_df['followed_player_ids'].
    value_counts().
    reset_index().
    rename(
      columns = {
        "followed_player_ids": "player_id",
        "count": "num_followers"
        }),
  players[['id', 'nameFirstLast']].
    rename(
      columns = {"id": "player_id", "nameFirstLast": "player_name"}
      ),
  on = 'player_id',
  how = 'left'
  ).
  # Filter to top 50 players
  nlargest(50, 'num_followers')
  )

most_followed_players

# Create barplot showing most followed MLB players
plt.figure(figsize=(12, 8))
sns.barplot(x='num_followers', y='player_name', data=most_followed_players,
    orient='h', color='blue')
plt.title('Most Followed MLB Players')
plt.xlabel('Number of Followers')
plt.ylabel('Player Name')

# Add text labels for # of followers next to each bar
for index, row in most_followed_players.iterrows():
  plt.text(row['num_followers'], index, str(row['num_followers']),
    color='black', ha='left', va='center')

plt.show()
Exploring MLB Fan Content Interaction Data
There is a large dataset with data on the interaction of MLB fans with various content on MLB digital properties. Below, we read in just 1 of the dozens of JSON files with this information in to show what it looks like.
#@title Read in Example MLB Fan Content Interaction Data File from Google Cloud Storage
mlb_fan_content_interaction_json_file = 'https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/mlb-fan-content-interaction-data/mlb-fan-content-interaction-data-000000000000.json'

mlb_fan_content_interaction_df = load_newline_delimited_json(
    mlb_fan_content_interaction_json_file)

display(mlb_fan_content_interaction_df)

#@title See What Dates, Content Types, and Sources Are Present
date_counts = mlb_fan_content_interaction_df['date_time_date'].value_counts()

display(date_counts)

content_type_counts = (mlb_fan_content_interaction_df['content_type'].
    value_counts())

display(content_type_counts)

content_source_counts = (mlb_fan_content_interaction_df['source'].
    value_counts())

display(content_source_counts)

#@title Find Content Pieces with Most Interaction in This Data
interaction_by_content = (mlb_fan_content_interaction_df[
    ['slug', 'content_type', 'content_headline']].
    value_counts().
    reset_index().
    rename(columns = {"count": "num_interactions"})
    )

display(interaction_by_content)

#@title Generate MLB.com Link for Article or Video for Specific Content Piece
# Pick single content piece to get link for
content_slug = "every-2024-mlb-trade-deadline-deal" # @param {type:"string"}
content_type = "article" # @param {type:"string"} ['article', 'video']

content_type_cat = ('news' if (content_type == 'article') else 'video')

content_mlb_com_link = f'https://www.mlb.com/{content_type_cat}/{content_slug}'

print(content_mlb_com_link)

Exploring MLB Caption Data
There is an interesting text-heavy dataset with captions from the game broadcast of some MLB games, mapped to timestamps within the game (so that you can potentially try to match play-level data with these captions). Below, we read in all of the JSON files with this information in, combine them into 1 data frame, and do some preliminary analysis.

#@title Read in All MLB Caption Data from Google Cloud Storage
mlb_captions_base_url = 'https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/mlb-caption-data/mlb-captions-data-*.json'
all_dfs = []
i = 0

# Loop over files labeled ""...00" to "...12"
for i in np.arange(0, 13):
    this_url = mlb_captions_base_url.replace("*", str(i).zfill(12))
    this_df = load_newline_delimited_json(this_url)
    all_dfs.append(this_df)
    i += 1

mlb_captions_df = pd.concat(all_dfs, ignore_index=True)

display(mlb_captions_df.head())

#@title See What Dates and Feed Types Are Present
# Convert 'write_date' to date only field
mlb_captions_df['write_date_only'] = (pd.to_datetime(
    mlb_captions_df['write_date']).dt.date)

date_counts = mlb_captions_df['write_date_only'].value_counts()

display(date_counts)

feed_type_counts = mlb_captions_df['feed_type'].value_counts()

display(feed_type_counts)
#@title Get MLB Film Room Video Clip for Last Play from Specific Game
# Pick game to get last play from (default is game_pk 747066, for Braves-Royals
# game with Travis d'Arnaud walk-off HR on 9/28/2024)
game_pk = '747066' #@param{type:"string"}

single_game_feed_url = f'https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live'

single_game_info_json = json.loads(requests.get(single_game_feed_url).content)

single_game_play = single_game_info_json['liveData']['plays']['currentPlay']

single_game_play_id = single_game_play['playEvents'][-1]['playId']

single_play_video_url = f'https://www.mlb.com/video/search?q=playid=\"{single_game_play_id}\"'

display(single_play_video_url)

#@title Get Captions Data Corresponding to Specific Play

# This is specific to the walk-off HR in game_pk 747066, with caption time codes
# found manually
single_play_captions = (mlb_captions_df[
    (mlb_captions_df['game_pk'] == game_pk)
    &
    (mlb_captions_df['feed_type'] == 'H')
    &
    (mlb_captions_df['caption_start'] >= '03:08:25.00000')
    &
    (mlb_captions_df['caption_end'] <= '03:10:21.0000')
    ].
    sort_values(['caption_start']).
    reset_index(drop = True)
    )

display(single_play_captions[['caption_start', 'caption_end', 'caption_text']])