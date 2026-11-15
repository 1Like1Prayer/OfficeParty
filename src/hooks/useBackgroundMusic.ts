import { useSyncExternalStore } from 'react'
import { backgroundMusic, type MusicState } from '../audio/backgroundMusic.ts'

/** The background music's state, kept up to date as it plays. */
export function useBackgroundMusic(): MusicState {
  return useSyncExternalStore(backgroundMusic.subscribe, backgroundMusic.getState)
}
