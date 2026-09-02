import {
  selectPlayerCountLabel,
  selectPlaylistRows,
  selectRoundLabel,
  selectScoreboardRows,
} from '../../selectors/index.ts'
import { useConnectionStatus, useRoom } from '../../socket/index.ts'
import { ArenaLayout } from '../ArenaLayout/index.ts'
import { ConnectionGate } from '../ConnectionGate/index.ts'
import { Scoreboard } from '../Scoreboard/index.ts'
import { ArenaPhase } from './ArenaPhase.tsx'

/** Top-level arena screen: binds room state to the layout and phase screens. */
export function Arena() {
  const { status, handshakeError } = useConnectionStatus()
  const { state: room, round, results, leaderboard, progress, error, actions } = useRoom()

  return (
    <ConnectionGate
      status={status}
      hasState={room !== null}
      error={handshakeError ?? (room === null ? error : null)}
    >
      {room && (
        <ArenaLayout
          roundLabel={selectRoundLabel(room, round)}
          notice={error}
          aside={
            <Scoreboard
              rows={selectScoreboardRows(room, round)}
              playerCountLabel={selectPlayerCountLabel(room)}
              playlist={selectPlaylistRows(room, round)}
            />
          }
        >
          <ArenaPhase
            room={room}
            round={round}
            results={results}
            leaderboard={leaderboard}
            progress={progress}
            actions={actions}
          />
        </ArenaLayout>
      )}
    </ConnectionGate>
  )
}
