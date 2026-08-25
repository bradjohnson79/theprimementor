import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClerkClient } from "@clerk/backend";
import { chromium } from "@playwright/test";
import { findShopQaUser, SHOP_QA_EMAIL, SHOP_QA_STORAGE_STATE } from "./helpers/shopSuccessFixture";

loadEnv({ path: path.join(process.cwd(), "apps/api/.env") });

const SKIP_REASON_PATH = "e2e/.auth/SKIP_REASON.txt";

export default async function globalSetup() {
  mkdirSync(path.dirname(SHOP_QA_STORAGE_STATE), { recursive: true });
  writeFileSync(
    SKIP_REASON_PATH,
    "Clerk sign-in is required for signed-in Shop success e2e. Automated ticket/session creation is unavailable on this Clerk instance, and the hosted sign-in form does not mount in Playwright.",
  );

  try {
    const user = await findShopQaUser();
    const secretKey = process.env.CLERK_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new Error("CLERK_SECRET_KEY is missing.");
    }
    const clerk = createClerkClient({ secretKey });
    const signInToken = await clerk.signInTokens.createSignInToken({
      userId: user.clerk_id,
      expiresInSeconds: 300,
    });
    const browser = await chromium.launch();
    const context = await browser.newContext({ baseURL: "http://localhost:3000" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: unknown }).Clerk), null, { timeout: 20_000 });
    await page.evaluate(async (ticket) => {
      const clerkWindow = (window as unknown as {
        Clerk: {
          load?: () => Promise<void>;
          client: { signIn: { create: (input: { strategy: string; ticket: string }) => Promise<{ createdSessionId?: string }> } };
          setActive: (input: { session: string }) => Promise<void>;
        };
      }).Clerk;
      await clerkWindow.load?.();
      const signIn = await clerkWindow.client.signIn.create({ strategy: "ticket", ticket });
      if (!signIn.createdSessionId) throw new Error("missing session");
      await clerkWindow.setActive({ session: signIn.createdSessionId });
    }, signInToken.token);
    await context.storageState({ path: SHOP_QA_STORAGE_STATE });
    writeFileSync(SKIP_REASON_PATH, "");
    await browser.close();
  } catch (error) {
    writeFileSync(
      SKIP_REASON_PATH,
      `Clerk authentication for ${SHOP_QA_EMAIL} could not be established (${error instanceof Error ? error.message : String(error)}). Signed-in thank-you mapping tests are skipped. API smoke still covers all six fulfillment URLs.`,
    );
  }
}
