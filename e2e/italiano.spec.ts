import { expect, test } from "@playwright/test";

test("la homepage è in italiano e non scorre in orizzontale", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Concediti un momento tutto per te." })).toBeVisible();
  await expect(page.getByText(/prenotazioni online saranno disponibili|Come possiamo prenderci cura/)).toBeVisible({ timeout: 20000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});

test("accesso, privacy e condizioni sono in italiano", async ({ page }) => {
  await page.goto("/accesso");
  await expect(page.getByRole("heading", { name: "Accedi" })).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Informativa sulla privacy" })).toBeVisible();
  await page.goto("/condizioni");
  await expect(page.getByRole("heading", { name: "Condizioni di prenotazione" })).toBeVisible();
});
