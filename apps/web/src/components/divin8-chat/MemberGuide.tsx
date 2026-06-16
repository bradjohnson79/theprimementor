import { classNames } from "@wisdom/ui/divin8-chat";
import ContactGuideCard from "./ContactGuideCard";
import GuideSectionCard from "./GuideSectionCard";
import { contactGuideSection, guideSections } from "./guideContent";

interface MemberGuideProps {
  isLightTheme?: boolean;
}

export default function MemberGuide({ isLightTheme = false }: MemberGuideProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-accent-cyan">How to get stronger readings</p>
        <p className={classNames("mt-1 text-xs leading-5", isLightTheme ? "text-slate-500" : "text-white/55")}>
          Use a clear subject, add saved profiles when birth data matters, and choose real category tags when you want a specific reading lens.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {guideSections.map((section) => (
          <GuideSectionCard key={section.title} section={section} />
        ))}
        <ContactGuideCard section={contactGuideSection} />
      </div>
    </div>
  );
}
