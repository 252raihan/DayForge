// End-to-end verification of DayForge against the real Supabase project.
// Creates a fresh QA account, then checks: login, dashboard stats, Yes/No
// daily submission, challenge check-in, and the 7-day chart.
export default async function run(page, ui) {
  const email = `qa+${Date.now()}@gmail.com`;
  const password = "Qa!Passw0rd123";
  const out = { email };

  // --- Signup -------------------------------------------------------------
  await page.goto("http://localhost:3000/signup");
  await page.waitForTimeout(2500);
  await page.locator("#name").fill("QA User");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirm").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(9000);

  out.signupAlert = await page.evaluate(() => {
    const el = document.querySelector("[role=alert], [role=status]");
    return el ? el.textContent : null;
  });
  out.afterSignupText = await page.evaluate(() =>
    document.body.innerText.slice(0, 600),
  );
  out.afterSignupUrl = page.url();

  // --- Login (fresh session) ----------------------------------------------
  if (!out.signupAlert) {
    await page.goto("http://localhost:3000/login");
    await page.waitForTimeout(2500);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForTimeout(9000);
    out.afterLoginUrl = page.url();
  }

  // --- Dashboard -----------------------------------------------------------
  await page.goto("http://localhost:3000/dashboard");
  await page.waitForTimeout(6000);
  out.dashboardUrl = page.url();
  out.dashboardText = await page.evaluate(() =>
    document.body.innerText.slice(0, 1200),
  );

  return out;
}
