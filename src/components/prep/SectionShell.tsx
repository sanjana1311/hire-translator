import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface SectionShellProps {
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

const SectionShell = ({ number, title, subtitle, icon, children, defaultOpen = false, badge }: SectionShellProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="apple-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center gap-3.5 hover:bg-foreground/[0.02] transition-colors text-left"
      >
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Section {number}</span>
            {badge && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-foreground/[0.05] text-foreground/70">{badge}</span>
            )}
          </div>
          <h3 className="text-sm font-semibold mt-0.5">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 border-t border-border/60 pt-4">{children}</div>}
    </div>
  );
};

export default SectionShell;
