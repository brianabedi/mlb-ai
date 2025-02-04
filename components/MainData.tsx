import * as React from "react"
import GamePredictions from "./MainDataComponents/GamePredictions"
import Following from "./MainDataComponents/Following"
import PlayerRankings from "./MainDataComponents/PlayerRankings"
import Reports from "./MainDataComponents/Reports"
import TeamRankings from "./MainDataComponents/TeamRankings"
export default function MainData() {
  return (
    <div className="grid grid-cols-3 gap-4">
         <GamePredictions />
     <Following/>
     <PlayerRankings/> 
     <Reports/>
     <TeamRankings/>
    </div>


  )
}
