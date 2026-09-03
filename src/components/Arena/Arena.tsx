import { useState } from 'react'
import { useCodeEntry } from '../../hooks/index.ts'
import {
  selectPlayerCountLabel,
  selectRoundLabel,
  selectScoreboardRows,
} from '../../selectors/index.ts'
import { ROOM } from '../../shared/constants.ts'
import { useConnectionStatus, useRoom } from '../../socket/index.ts'
import { ArenaLayout } from '../ArenaLayout/index.ts'
import { ConnectionGate } from '../ConnectionGate/index.ts'
import { HostScreen, JoinScreen } from '../EntryScreen/index.ts'
import { Scoreboard } from '../Scoreboard/index.ts'
import { TitleScreen } from '../TitleScreen/index.ts'
import { ArenaPhase } from './ArenaPhase.tsx'

/**
 * Top-level screen. One tab is one player: it starts on the title card and
 * only enters a room once someone hosts or joins under a name.
 */
export function Arena() {
  const { status, handshakeError } = useConnectionStatus()
  const {
    stage,
    state: room,
    round,
    playerId,
    results,
    leaderboard,
    progress,
    scores,
    error,
    busy,
    actions,
  } = useRoom()
  const [name, setName] = useState('')
  const [nameDone, setNameDone] = useState(false)
  const code = useCodeEntry(ROOM.CODE_LENGTH, ROOM.CODE_ALPHABET)

  const inRoom = stage === 'room' && room !== null
  const roundPhase = round.phase
  // The round takes the whole screen from the moment it is being set up;
  // everything else keeps the chrome.
  const playing =
    inRoom &&
    room.phase === 'competition' &&
    ['starting', 'countdown', 'playing'].includes(roundPhase)
  const showScoreboard =
    inRoom &&
    !playing &&
    (room.phase === 'leaderboard' || room.phase === 'competition')

  return (
    <ConnectionGate status={status} error={handshakeError}>
      <ArenaLayout
        roundLabel={inRoom ? selectRoundLabel(room, round) : ''}
        showHeader={inRoom && !playing}
        notice={inRoom ? error : null}
        aside={
          showScoreboard && (
            <Scoreboard
              rows={selectScoreboardRows(room, round, scores, playerId)}
              playerCountLabel={selectPlayerCountLabel(room)}
            />
          )
        }
      >
        {stage === 'title' && (
          <TitleScreen
            minPlayers={ROOM.MIN_PLAYERS}
            maxPlayers={ROOM.MAX_PLAYERS}
            busy={busy}
            onHost={actions.goToHost}
            onJoin={() => {
              code.reset()
              setNameDone(false)
              actions.goToJoin()
            }}
          />
        )}

        {stage === 'host' && (
          <HostScreen
            name={name}
            error={error}
            busy={busy}
            onName={setName}
            onHost={() => { actions.host(name.trim()) }}
            onBack={actions.goToTitle}
          />
        )}

        {stage === 'join' && (
          <JoinScreen
            name={name}
            code={code.entry}
            nameDone={nameDone}
            error={error}
            busy={busy}
            onName={setName}
            onNameDone={() => { setNameDone(true) }}
            onCode={code.set}
            onJoin={() => { actions.join(name.trim(), code.entry) }}
            onBack={actions.goToTitle}
          />
        )}

        {inRoom && (
          <ArenaPhase
            room={room}
            playerId={playerId}
            round={round}
            results={results}
            leaderboard={leaderboard}
            progress={progress}
            actions={actions}
          />
        )}
      </ArenaLayout>
    </ConnectionGate>
  )
}
