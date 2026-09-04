import { test, expect } from '@playwright/test';

test.describe('Enterprise Security & Fraud Prevention', () => {

  test('Impossible Travel Engine triggers OTP challenge for geographically distant IPs', async ({ browser }) => {
    // LOGIN 1: New York, USA
    const nyContext = await browser.newContext({
      extraHTTPHeaders: { 'x-forwarded-for': '161.185.160.93' } 
    });
    const nyPage = await nyContext.newPage();
    
    await nyPage.goto('/login');
    await nyPage.fill('input[name="username"]', 'eshaan');
    await nyPage.fill('input[name="password"]', 'eshaan_49');
    await nyPage.getByRole('button', { name: 'Continue', exact: true }).click();
    
    await expect(nyPage).toHaveURL(/.*\/listings/);
    await nyContext.close();

    // LOGIN 2: Tokyo, Japan (using a reliable host IP)
    const tokyoContext = await browser.newContext({
      extraHTTPHeaders: { 'x-forwarded-for': '133.242.180.100' } 
    });
    const tokyoPage = await tokyoContext.newPage();
    
    await tokyoPage.goto('/login');
    await tokyoPage.fill('input[name="username"]', 'eshaan');
    await tokyoPage.fill('input[name="password"]', 'eshaan_49');
    await tokyoPage.getByRole('button', { name: 'Continue', exact: true }).click();

    // Verify redirection to the security verification route
    await expect(tokyoPage).toHaveURL(/.*\/verify-security-otp/);
    
    await tokyoContext.close();
  });

});