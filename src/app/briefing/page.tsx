import { BriefingConfiguration } from "@/components/briefing/briefing-configuration";
import {
  defaultBriefingPreferences,
  getBriefingPreferences,
} from "@/lib/briefing-preferences";
import { getAccessState } from "@/lib/access";
import { isClerkConfigured } from "@/lib/auth-config";
import { newsCategories } from "@/lib/topic-types";

export const dynamic = "force-dynamic";

export default async function BriefingPage() {
  const authConfigured = isClerkConfigured();
  const access = authConfigured ? await getAccessState() : null;
  const preferences = access?.member
    ? await getBriefingPreferences(access.member.id)
    : defaultBriefingPreferences;

  return (
    <BriefingConfiguration
      authConfigured={authConfigured}
      isMember={Boolean(access?.isMember)}
      email={access?.member?.email ?? null}
      membershipLabel={
        access?.isSubscriber
          ? "Subscriber"
          : access?.isMember
            ? "Member"
            : "Guest"
      }
      initialPreferences={preferences}
      availableCategories={newsCategories}
    />
  );
}
