import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ApplicationStageChangedTemplate,
  applicationStageChangedEmailText,
} from "@/backend/email/templates/application-stage-changed";

describe("application stage changed email", () => {
  it("renders candidate-safe application context and a detail link", () => {
    const props = {
      stageLabel: "Shortlisted",
      jobTitle: "Frontend Engineer",
      companyName: "SmartHire",
      applicationUrl: "http://localhost:3001/jobs/applied/application-1",
    };
    const html = renderToStaticMarkup(
      <ApplicationStageChangedTemplate {...props} />,
    );
    const text = applicationStageChangedEmailText(props);

    expect(html).toContain("Shortlisted");
    expect(html).toContain("Frontend Engineer");
    expect(html).toContain(props.applicationUrl);
    expect(text).toContain(props.applicationUrl);
    expect(`${html}${text}`).not.toMatch(/internal|reasonCode|actorUserId/u);
  });
});
