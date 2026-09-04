import { test, expect } from '@playwright/test';

test.describe('Booking Engine & AI Integrations', () => {

  // Runs BEFORE every test to ensure the robot is logged in
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    
    // Using your normal user account
    await page.fill('input[name="username"]', 'pratham'); 
    await page.fill('input[name="password"]', 'pratham_49'); // Update this!
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  });

 test('AI Trip Planner successfully generates an itinerary', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/listings');
    await page.locator('.listing-link').first().click();

    // 1. Wait until client-side scripts (ai.js) are fully loaded and bound
    await page.waitForLoadState('domcontentloaded');

    const itineraryBtn = page.locator('#itinerary-btn');
    await expect(itineraryBtn).toBeVisible();
    await itineraryBtn.click();

    // 2. Wait for the container to become visible when ai.js fires
    const itineraryOutput = page.locator('#itinerary-output');
    await expect(itineraryOutput).toBeVisible({ timeout: 45000 });

    // 3. Verify the generated itinerary text is populated
    const itineraryText = page.locator('#itinerary-text');
    await expect(itineraryText).not.toBeEmpty({ timeout: 45000 });
  });

  test('User can open a listing and initiate a reservation', async ({ page }) => {
    await page.goto('/listings');
    await page.locator('.listing-link').first().click();

    // 1. Simulate typing dates into your Flatpickr calendar
    await page.evaluate(() => {
      document.querySelector('#checkIn').value = '2026-08-01';
      document.querySelector('#checkOut').value = '2026-08-05';
    });

    // 2. Click the Reserve button
    await page.locator('button:has-text("Reserve")').click();

    // 3. Verify that the reservation was processed and redirected to the trips page
    await expect(page).toHaveURL(/.*\/trips/);
    
    // 4. Check for the success flash message
    const flashMessage = page.locator('.alert-success');
    await expect(flashMessage).toBeVisible();
  });

});