import { eq, asc } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

export const GAME_SORT_OPTIONS = ['title-asc', 'title-desc', 'rating-desc'] as const;
export type GameSortOption = (typeof GAME_SORT_OPTIONS)[number];
export const DEFAULT_GAME_SORT: GameSortOption = 'title-asc';

export function isGameSortOption(value: string | null): value is GameSortOption {
    return value !== null && GAME_SORT_OPTIONS.includes(value as GameSortOption);
}

function compareTitles(a: Pick<Game, 'title'>, b: Pick<Game, 'title'>): number {
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

export function sortGames(gamesToSort: Game[], sort: GameSortOption = DEFAULT_GAME_SORT): Game[] {
    const sorted = [...gamesToSort];

    sorted.sort((a, b) => {
        switch (sort) {
            case 'title-desc':
                return compareTitles(b, a);
            case 'rating-desc': {
                const aRating = a.starRating ?? null;
                const bRating = b.starRating ?? null;

                if (aRating === null && bRating === null) {
                    return compareTitles(a, b);
                }
                if (aRating === null) {
                    return 1;
                }
                if (bRating === null) {
                    return -1;
                }

                const ratingDelta = bRating - aRating;
                return ratingDelta !== 0 ? ratingDelta : compareTitles(a, b);
            }
            case 'title-asc':
            default:
                return compareTitles(a, b);
        }
    });

    return sorted;
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** All games ordered by the requested sort, defaulting to title A–Z. */
export async function getAllGames(db: Database, sort: GameSortOption = DEFAULT_GAME_SORT): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return sortGames(rows.map(mapGame), sort);
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
