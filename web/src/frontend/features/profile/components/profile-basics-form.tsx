"use client";

import { useForm } from "react-hook-form";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";
import { useServerFormReconciliation } from "../client/use-server-form-reconciliation";
import type {
  ProfileEditorFeedback,
  ProfileSectionDraft,
} from "../client/use-profile-editor";

type BasicsValues = {
  headline: string;
  summary: string;
  phone: string;
  location: string;
};

const valuesFrom = (
  basics: CandidateProfileContract["basics"],
): BasicsValues => ({
  headline: basics.headline ?? "",
  summary: basics.summary ?? "",
  phone: basics.phone ?? "",
  location: basics.location ?? "",
});

export function ProfileBasicsForm({
  profile,
  saving,
  feedback,
  onSave,
}: {
  profile: CandidateProfileContract;
  saving: boolean;
  feedback: ProfileEditorFeedback | null;
  onSave: (draft: ProfileSectionDraft) => Promise<boolean>;
}) {
  const { register, handleSubmit, reset } = useForm<BasicsValues>({
    defaultValues: valuesFrom(profile.basics),
  });

  useServerFormReconciliation(valuesFrom(profile.basics), reset);

  const fieldError = (path: string) => feedback?.fieldErrors?.[path]?.[0];

  return (
    <form
      className="professional-profile-section"
      aria-labelledby="profile-basics-title"
      onSubmit={handleSubmit(async (values) => {
        await onSave({
          section: "basics",
          basics: {
            headline: values.headline || null,
            summary: values.summary || null,
            phone: values.phone || null,
            location: values.location || null,
          },
        });
      })}
    >
      <div className="professional-profile-section-heading">
        <div>
          <p className="panel-kicker">INTRODUCTION</p>
          <h2 id="profile-basics-title">Professional basics</h2>
        </div>
        <button type="submit" disabled={saving}>
          {saving ? "Saving basics…" : "Save basics"}
        </button>
      </div>
      <div className="professional-profile-fields">
        <label htmlFor="profile-headline">Headline</label>
        <input
          id="profile-headline"
          {...register("headline")}
          data-field-path="basics.headline"
          maxLength={200}
        />
        {fieldError("basics.headline") ? (
          <p className="profile-field-error">{fieldError("basics.headline")}</p>
        ) : null}

        <label htmlFor="profile-summary">Summary</label>
        <textarea
          id="profile-summary"
          {...register("summary")}
          data-field-path="basics.summary"
          maxLength={5_000}
          rows={5}
        />
        {fieldError("basics.summary") ? (
          <p className="profile-field-error">{fieldError("basics.summary")}</p>
        ) : null}

        <label htmlFor="profile-phone">Phone</label>
        <input
          id="profile-phone"
          {...register("phone")}
          data-field-path="basics.phone"
          inputMode="tel"
          maxLength={32}
          aria-describedby="profile-phone-hint"
        />
        <p id="profile-phone-hint" className="profile-field-hint">
          Use 7–15 digits with optional spaces, periods, hyphens, parentheses,
          or one leading plus.
        </p>
        {fieldError("basics.phone") ? (
          <p className="profile-field-error">{fieldError("basics.phone")}</p>
        ) : null}

        <label htmlFor="profile-location">Location</label>
        <input
          id="profile-location"
          {...register("location")}
          data-field-path="basics.location"
          maxLength={160}
        />
        {fieldError("basics.location") ? (
          <p className="profile-field-error">{fieldError("basics.location")}</p>
        ) : null}
      </div>
    </form>
  );
}
