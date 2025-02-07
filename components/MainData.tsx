import * as React from "react"
import GamePredictions from "./MainDataComponents/GamePredictions"
import Following from "./MainDataComponents/Following"
import PlayerRankings from "./MainDataComponents/PlayerRankings"
import Reports from "./MainDataComponents/Reports"
import TeamRankings from "./MainDataComponents/TeamRankings"
export default function MainData() {
  return (
  <div className="grid sm:grid-cols-3 grid-cols-1 gap-4">
    <div className="col-span-2"><GamePredictions   />
      <PlayerRankings   />
      <TeamRankings /></div>
      
      <div className="col-span-2 sm:col-span-1">  <Following  />
      <Reports   /></div>

    
    </div>

  )
}
