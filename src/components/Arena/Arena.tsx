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
  const status = useConnectionStatus()
  const { state: room, error, actions } = useRoom()

  return (
    <ConnectionGate status={status} hasState={room !== null} error={error}>
      {room && (
        <ArenaLayout
          roundLabel={selectRoundLabel(room)}
          aside={
            <Scoreboard
              rows={selectScoreboardRows(room)}
              playerCountLabel={selectPlayerCountLabel(room)}
              playlist={selectPlaylistRows(room)}
            />
          }
        >
          <ArenaPhase room={room} actions={actions} />
        </ArenaLayout>
      )}
    </ConnectionGate>
  )
}
