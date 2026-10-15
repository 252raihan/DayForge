export default async function run(page, ui) {
  const email = `qa+${Date.now()}@dayforge-qa.example`;
  const password = "Qa!Passw0rd123";

  await page.waitForTimeout(3000);
  const inputIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll("form input")).map((el) => ({
      id: el.id,
      type: el.type,
      value: el.value,
    })),
  );
  await page.locator("#name").fill("QA User");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirm").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Wait for either the app shell or an error message to appear.
  await page.waitForTimeout(8000);
  const snap = await ui.snapshot({ full: true });
  const alertText = await page.evaluate(() => {
    const el = document.querySelector('[role=alert]');
    return el ? el.textContent : null;
  });
  return { email, password, inputIds, alertText, snap };
}
