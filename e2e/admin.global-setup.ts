import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClerkClient } from "@clerk/backend";
import { chromium } from "@playwright/test";
import {
  ADMIN_SKIP_REASON_PATH,
  ADMIN_STORAGE_STATE,
  adminBaseUrl,
  findAdminE2EUser,
} from "./helpers/adminAuth.ts";

loadEnv({ path: path.join(process.cwd(), "apps/api/.env") });

export default async function globalSetup() {
  mkdirSync(path.dirname(ADMIN_STORAGE_STATE), { recursive: true });
  writeFileSync(
    ADMIN_SKIP_REASON_PATH,
    "Admin Clerk ticket/session creation has not completed.",
  );
  writeFileSync(ADMIN_STORAGE_STATE, JSON.stringify({ cookies: [], origins: [] }));

  try {
    const user = await findAdminE2EUser();
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
    const context = await browser.newContext({ baseURL: adminBaseUrl() });
    const page = await context.newPage();
    await page.goto("/admin/ads");
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
    await page.waitForURL(/\/admin/, { timeout: 20_000 });
    await context.storageState({ path: ADMIN_STORAGE_STATE });
    writeFileSync(ADMIN_SKIP_REASON_PATH, "");
    await browser.close();
  } catch (error) {
    writeFileSync(
      ADMIN_SKIP_REASON_PATH,
      `Admin Clerk ticket authentication could not be established (${error instanceof Error ? error.message : String(error)}).`,
    );
  }
}
