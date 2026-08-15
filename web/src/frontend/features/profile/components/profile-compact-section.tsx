import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  GraduationCap,
  Link2,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { Panel } from "@/frontend/components/ui/design-system";

const sectionIcons: Record<string, LucideIcon> = {
  ID: UserRound,
  SK: Sparkles,
  EX: BriefcaseBusiness,
  ED: GraduationCap,
  IN: Link2,
};

export function ProfileCompactSection({
  sectionId,
  titleId,
  kicker,
  title,
  mark,
  count,
  content,
  action,
  feedback,
}: {
  sectionId: string;
  titleId: string;
  kicker: string;
  title: string;
  mark: string;
  count?: string;
  content: ReactNode;
  action: ReactNode;
  feedback: ReactNode;
}) {
  const Icon = sectionIcons[mark] ?? UserRound;

  return (
    <Panel
      as="section"
      id={sectionId}
      className="candidate-section candidate-section--readonly"
      aria-labelledby={titleId}
      eyebrow={
        <>
          <span className="profile-compact-eyebrow-mark" aria-hidden="true">
            <Icon />
          </span>
          {kicker}
        </>
      }
      title={title}
      titleId={titleId}
      rightSlot={
        <div className="profile-compact-header-actions">
          {count ? (
            <span className="profile-section-count count-pill">{count}</span>
          ) : null}
          {action}
        </div>
      }
    >
      <div className="profile-compact-content">{content}</div>
      {feedback}
    </Panel>
  );
}
