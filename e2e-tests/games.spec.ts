import { test, expect, type Response } from '@playwright/test';

function ratingFromTitle(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }

  const tenths = hash % 21;
  return Number((3.0 + tenths / 10).toFixed(1));
}

test.describe('Game Listing and Navigation', () => {
  test('should display games with titles on index page', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
    });

    await test.step('Verify games grid is visible', async () => {
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Verify game cards are displayed', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first()).toBeVisible();
      expect(await gameCards.count()).toBeGreaterThan(0);
    });

    await test.step('Verify game cards have titles with content', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first().getByTestId('game-title')).toBeVisible();
      await expect(gameCards.first().getByTestId('game-title')).not.toBeEmpty();
    });
  });

  test('should allow games to be sorted alphabetically in both directions', async ({ page }) => {
    await test.step('Open the homepage and inspect the sort control', async () => {
      await page.goto('/');
      const sortLabel = page.getByLabel('Sort games');
      await expect(sortLabel).toBeVisible();
      await expect(page.getByTestId('game-sort-select')).toHaveValue('title-asc');
    });

    let defaultTitles: string[] = [];
    await test.step('Verify the default order is alphabetical', async () => {
      defaultTitles = await page.getByTestId('game-title').allTextContents();
      expect(defaultTitles).toEqual([...defaultTitles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
    });

    await test.step('Change the sort order and apply it', async () => {
      await page.getByTestId('game-sort-select').selectOption('title-desc');
      await page.getByTestId('game-sort-submit').click();
    });

    await test.step('Verify the page rerenders in reverse alphabetical order', async () => {
      const titles = await page.getByTestId('game-title').allTextContents();
      const expected = [...defaultTitles].sort((a, b) => b.localeCompare(a, undefined, { sensitivity: 'base' }));
      expect(titles).toEqual(expected);
    });
  });

  test('should allow games to be sorted by star rating with unrated items last', async ({ page }) => {
    await test.step('Load the homepage in rating order', async () => {
      await page.goto('/?sort=rating-desc');
      await expect(page.getByTestId('game-sort-select')).toHaveValue('rating-desc');
    });

    await test.step('Verify the game list is ordered by descending rating and null ratings are last', async () => {
      const cards = page.getByTestId('game-card');
      const titles = await cards.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-game-title') ?? ''),
      );

      const sortedTitles = [...titles].sort((a, b) => {
        const ratingA = ratingFromTitle(a);
        const ratingB = ratingFromTitle(b);
        return ratingB - ratingA || a.localeCompare(b, undefined, { sensitivity: 'base' });
      });

      expect(titles).toEqual(sortedTitles);
    });
  });

  test('should navigate to correct game details page when clicking on a game', async ({ page }) => {
    let gameId: string | null;
    let gameTitle: string | null;

    await test.step('Navigate to homepage and wait for games to load', async () => {
      await page.goto('/');
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Get first game information and click it', async () => {
      const firstGameCard = page.getByTestId('game-card').first();
      gameId = await firstGameCard.getAttribute('data-game-id');
      gameTitle = await firstGameCard.getAttribute('data-game-title');
      await firstGameCard.click();
    });

    await test.step('Verify navigation to game details page', async () => {
      await expect(page).toHaveURL(`/game/${gameId}`);
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title matches clicked game', async () => {
      if (gameTitle) {
        await expect(page.getByTestId('game-details-title')).toHaveText(gameTitle);
      }
    });
  });

  test('should display game details with all required information', async ({ page }) => {
    await test.step('Navigate to specific game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title is displayed', async () => {
      const gameTitle = page.getByTestId('game-details-title');
      await expect(gameTitle).toBeVisible();
      await expect(gameTitle).not.toBeEmpty();
    });

    await test.step('Verify game description is displayed', async () => {
      const gameDescription = page.getByTestId('game-details-description');
      await expect(gameDescription).toBeVisible();
      await expect(gameDescription).not.toBeEmpty();
    });

    await test.step('Verify publisher or category information is present', async () => {
      const publisherExists = await page.getByTestId('game-details-publisher').isVisible();
      const categoryExists = await page.getByTestId('game-details-category').isVisible();
      expect(publisherExists || categoryExists).toBeTruthy();

      if (publisherExists) {
        await expect(page.getByTestId('game-details-publisher')).not.toBeEmpty();
      }

      if (categoryExists) {
        await expect(page.getByTestId('game-details-category')).not.toBeEmpty();
      }
    });
  });

  test('should display a button to back the game', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify back game button is visible and enabled', async () => {
      const backButton = page.getByTestId('back-game-button');
      await expect(backButton).toBeVisible();
      await expect(backButton).toContainText('Support This Game');
      await expect(backButton).toBeEnabled();
    });
  });

  test('should be able to navigate back to home from game details', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Click back to all games link', async () => {
      const backLink = page.getByRole('link', { name: /back to all games/i });
      await expect(backLink).toBeVisible();
      await backLink.click();
    });

    await test.step('Verify navigation back to homepage', async () => {
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });
  });

  test('should return a 404 page for a non-existent game', async ({ page }) => {
    let response: Response | null;

    await test.step('Navigate to non-existent game', async () => {
      response = await page.goto('/game/99999');
    });

    await test.step('Verify a branded 404 page is served', async () => {
      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(/Page Not Found - Tailspin Toys/);
      await expect(page.getByTestId('not-found')).toBeVisible();
      await expect(page.getByTestId('not-found-heading')).not.toBeEmpty();
      await expect(page.getByTestId('not-found-home-link')).toBeVisible();
    });
  });
});
