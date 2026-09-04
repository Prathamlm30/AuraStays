import { test, expect } from '@playwright/test';

test.describe('Authentication & Access Control', () => {

  test('Guest user is blocked from creating listings', async ({ page }) => {
    // 1. Robot tries to sneak into a protected route
    // (Notice we only need '/listings/new' now because of the baseURL we set!)
    await page.goto('/listings/new');
    
    // 2. We expect your middleware to bounce the robot back to the login page
    await expect(page).toHaveURL(/.*\/login/);
    
    // 3. We expect your flash message to appear
    const flashMessage = page.locator('.alert-danger');
    await expect(flashMessage).toBeVisible();
    await expect(flashMessage).toContainText('You must be logged in');
  });

  test('Admin user can access the Command Center', async ({ page }) => {
    // 1. Robot goes to login
    await page.goto('/login');
    
    // IMPORTANT: Change these to match the admin account in your local MongoDB!
    await page.fill('input[name="username"]', 'Admin'); 
    await page.fill('input[name="password"]', 'Admin_Aurastays@4949'); 
    // Using exact match so it doesn't accidentally click "Continue with Google"
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    // 2. Robot clicks the profile pill in the navbar
    await page.click('.profile-pill');

    // 3. Robot verifies the red Command Center link is visible
    const commandCenterLink = page.locator('text=Command Center');
    await expect(commandCenterLink).toBeVisible();
    
    // 4. Robot clicks it and verifies it loads the dashboard
    await commandCenterLink.click();
    await expect(page).toHaveURL('/admin/dashboard');
  });

});