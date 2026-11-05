import { Download } from "lucide-react";

/** Static activation instructions. Served from apps/web/public. */
export const APPAREL_INSTRUCTION_MANUAL_PATH = "/shop/apparel/activation-instructions.pdf";

type ApparelInstructionManualProps = {
  className?: string;
};

export default function ApparelInstructionManual({ className = "" }: ApparelInstructionManualProps) {
  return (
    <div className={className}>
      <a
        href={APPAREL_INSTRUCTION_MANUAL_PATH}
        download="Activation-Instructions-for-Apparel.pdf"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-white/5 px-6 py-3.5 text-base font-semibold text-amber-100 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download Instruction Manual
      </a>
      <p className="mt-2 text-center text-sm leading-6 text-white/60">
        Free download for every Sacred Apparel design.
      </p>
    </div>
  );
}
