import type { Game } from "../types/game";

export type GameStatusVisibility = {
  showCompleted: boolean;
  showAbandoned: boolean;
  showPlayedState: boolean;
  showCurrentlyPlaying: boolean;
};

export function getGameStatusVisibility(game: Pick<Game, "isCompleted" | "isAbandoned" | "isCurrentlyPlaying">): GameStatusVisibility {
  const showCompleted = game.isCompleted;
  const showAbandoned = !showCompleted && game.isAbandoned;

  return {
    showCompleted,
    showAbandoned,
    showPlayedState: !showCompleted && !showAbandoned,
    showCurrentlyPlaying: !showCompleted && !showAbandoned && game.isCurrentlyPlaying,
  };
}
