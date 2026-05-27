export type MultiplayerType = "singleplayer" | "multiplayer" | "both" | "unknown";

export type SteamDeckCompatibility = "yes" | "no" | "unknown";

export type GameSource = "manual" | "steam" | "import";

export type EstimatedLength = "short" | "medium" | "long" | "unknown";

export type TurkishLanguageSupport = "yes" | "no" | "unknown";

export type Game = {
  id: number;
  title: string;
  normalizedTitle: string;
  releaseYear: number | null;
  coverPath: string | null;
  usePlaceholderCover: boolean;
  personalRating: number | null;
  notes: string | null;
  estimatedLength: EstimatedLength;
  turkishLanguageSupport: TurkishLanguageSupport;
  turkishPatchAvailable: boolean;
  isPlayed: boolean;
  isCompleted: boolean;
  isFavorite: boolean;
  isCurrentlyPlaying: boolean;
  isAbandoned: boolean;
  isInstalled: boolean;
  isWishlisted: boolean;
  neverShowInRandom: boolean;
  multiplayerType: MultiplayerType;
  steamDeckCompatible: SteamDeckCompatibility;
  source: GameSource;
  steamAppId: number | null;
  createdAt: string;
  updatedAt: string;
  genreNames?: string[];
  platformNames?: string[];
};

export type NewGameInput = Omit<
  Game,
  "id" | "createdAt" | "updatedAt" | "turkishLanguageSupport" | "turkishPatchAvailable"
> &
  Partial<Pick<Game, "turkishLanguageSupport" | "turkishPatchAvailable">>;

export type GameUpdateInput = Pick<
  Game,
  | "id"
  | "isPlayed"
  | "isCompleted"
  | "isFavorite"
  | "isCurrentlyPlaying"
  | "isAbandoned"
  | "isWishlisted"
  | "neverShowInRandom"
  | "multiplayerType"
  | "steamDeckCompatible"
  | "personalRating"
  | "notes"
  | "estimatedLength"
> & {
  releaseYear?: number | null;
  isInstalled?: boolean;
  turkishLanguageSupport?: TurkishLanguageSupport;
  turkishPatchAvailable?: boolean;
};

export type GameFormInput = {
  id?: number;
  title: string;
  releaseYear: number | null;
  coverPath: string | null;
  usePlaceholderCover: boolean;
  isPlayed: boolean;
  isCompleted: boolean;
  isFavorite: boolean;
  isCurrentlyPlaying: boolean;
  isAbandoned: boolean;
  isWishlisted: boolean;
  neverShowInRandom: boolean;
  multiplayerType: MultiplayerType;
  steamDeckCompatible: SteamDeckCompatibility;
  personalRating: number | null;
  notes: string | null;
  estimatedLength: EstimatedLength;
  turkishLanguageSupport: TurkishLanguageSupport;
  turkishPatchAvailable: boolean;
  genreNames: string[];
  platformNames: string[];
};

export type Platform = {
  id: number;
  name: string;
  logoPath: string | null;
};

export type Genre = {
  id: number;
  name: string;
};

export type GamePlatform = {
  gameId: number;
  platformId: number;
};

export type GameGenre = {
  gameId: number;
  genreId: number;
};

export type WishlistItem = {
  gameId: number;
  createdAt: string;
};

export type DuplicateCandidateStatus = "pending" | "merged" | "dismissed";

export type DuplicateCandidate = {
  id: number;
  gameAId: number;
  gameBId: number;
  reason: string;
  confidence: number;
  status: DuplicateCandidateStatus;
};
