import { createClerkClient } from "@clerk/backend";

export interface ClerkIdentity {
  clerkId: string;
  email: string;
}

export function resolvePrimaryEmail(clerkUser: {
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string }>;
}) {
  return (
    clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)?.emailAddress
    ?? clerkUser.emailAddresses[0]?.emailAddress
    ?? null
  );
}

export async function getClerkIdentity(secretKey: string, clerkId: string): Promise<ClerkIdentity> {
  const clerk = createClerkClient({ secretKey });
  const clerkUser = await clerk.users.getUser(clerkId);
  const email = resolvePrimaryEmail(clerkUser);

  if (!email) {
    throw new Error(`Clerk user ${clerkId} does not have a primary email address.`);
  }

  return {
    clerkId: clerkUser.id,
    email,
  };
}
