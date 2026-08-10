import { useId, useState } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";

export interface HowItWorksItem {
  title: string;
  description: string;
}

interface Props {
  items: HowItWorksItem[];
}

export function HowItWorks({ items }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-3">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls={panelId}
        className="how-it-works-toggle"
      >
        <span className="how-it-works-toggle-label">
          <Lightbulb size={14} />
          How it works
        </span>
        <ChevronDown
          size={14}
          className={`how-it-works-chevron ${open ? "how-it-works-chevron--open" : ""}`}
        />
      </button>
      <div
        id={panelId}
        className={`how-it-works-panel ${open ? "how-it-works-panel--open" : ""}`}
        role="region"
      >
        <div className="how-it-works-panel-inner">
          {items.map((item, index) => (
            <div
              key={item.title}
              className={`how-it-works-item ${
                index < items.length - 1 ? "how-it-works-item--bordered" : ""
              }`}
            >
              <span className="how-it-works-item-title">{item.title}</span>
              <span className="how-it-works-item-desc">{item.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}