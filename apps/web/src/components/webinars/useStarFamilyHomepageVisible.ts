import { useEffect, useState } from "react";
import {
  STAR_FAMILY_WEBINAR_HOME_REMOVAL_AT,
  isStarFamilyWebinarHomeVisible,
} from "@wisdom/utils";

const MAX_TIMEOUT_MS = 2_147_483_647;

export function useStarFamilyHomepageVisible() {
  const [visible, setVisible] = useState(() => isStarFamilyWebinarHomeVisible());

  useEffect(() => {
    let timer = 0;

    const schedule = () => {
      const now = Date.now();
      const removalAt = Date.parse(STAR_FAMILY_WEBINAR_HOME_REMOVAL_AT);
      const stillVisible = now < removalAt;
      setVisible(stillVisible);
      if (!stillVisible) return;
      timer = window.setTimeout(schedule, Math.min(removalAt - now, MAX_TIMEOUT_MS));
    };

    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  return visible;
}
