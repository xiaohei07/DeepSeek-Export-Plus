export async function acceptPrivacy(context) {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const origin = `chrome-extension://${new URL(worker.url()).hostname}`;
  const page = await context.newPage();
  await page.goto(origin + "/privacy/index.html");
  const allow = page.locator("#allow");
  await page.waitForFunction(
    () => document.querySelector("#status").textContent.length > 0,
  );
  if (await allow.isVisible()) {
    await allow.click();
    await page.waitForFunction(
      () =>
        document.querySelector("#revoke").hidden === false &&
        !document.querySelector("#revoke").disabled,
    );
  }
  await page.close();
  return worker;
}
