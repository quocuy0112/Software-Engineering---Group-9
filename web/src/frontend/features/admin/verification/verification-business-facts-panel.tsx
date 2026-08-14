"use client";

import { Alert, Box, Chip, Paper, Typography } from "@mui/material";
import type { VerificationBusinessFactsProjection } from "@/shared/contracts/admin/verification";

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <Box>
      <Typography color="text.secondary" variant="caption">{label}</Typography>
      <Typography sx={{ overflowWrap: "anywhere" }}>{value || "Not available"}</Typography>
    </Box>
  );
}

export function VerificationBusinessFactsPanel({
  facts,
  legacyRequest,
  enrichmentStatus,
}: {
  facts: VerificationBusinessFactsProjection | null;
  legacyRequest: boolean;
  enrichmentStatus?: "LEGACY" | "COMPLETE" | "INCOMPLETE";
}) {
  if (enrichmentStatus === "INCOMPLETE") {
    return <Alert severity="error">Enriched request is incomplete and cannot be approved.</Alert>;
  }
  if (legacyRequest || !facts) {
    return <Alert severity="info">Legacy request: enriched Feature 014 facts were not collected.</Alert>;
  }
  return (
    <Paper variant="outlined" sx={{ p: 2, display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Typography component="h2" variant="h6" sx={{ mr: "auto" }}>Business verification facts</Typography>
        <Chip label={`Registry: ${facts.registry.outcome}`} />
        <Chip label={facts.registry.stale ? "Registry snapshot stale" : "Registry snapshot current"} color={facts.registry.stale ? "warning" : "default"} />
        <Chip label="Email verified" color="success" />
        <Chip label="Phone unverified" color="warning" />
      </Box>
      <Typography color="text.secondary" variant="body2">
        Source {facts.registry.providerKey}; checked {new Date(facts.registry.checkedAt).toLocaleString()}. These signals support a human decision only.
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, display: "grid", gap: 1 }}>
          <Typography fontWeight={700}>Registry snapshot</Typography>
          <Fact label="Legal name" value={facts.registry.legalName} />
          <Fact label="Registered address" value={facts.registry.registeredAddress} />
          <Fact label="Established" value={facts.registry.establishedAt} />
          <Fact label="Legal status" value={facts.registry.legalStatus} />
          <Fact label="Entity type" value={facts.registry.entityType} />
          <Fact label="Representative (admin only)" value={facts.registry.representativeName} />
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, display: "grid", gap: 1 }}>
          <Typography fontWeight={700}>Applicant claims</Typography>
          <Fact label={facts.legalNameDiffers ? "Legal name — differs" : "Legal name — matches"} value={facts.applicantLegalName} />
          <Fact label={facts.registeredAddressDiffers ? "Registered address — differs" : "Registered address — matches"} value={facts.applicantRegisteredAddress} />
          <Fact label="Operating address" value={facts.operatingAddress} />
          <Fact label="Mismatch explanation" value={facts.mismatchExplanation} />
        </Paper>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
        <Fact label="Verified company email" value={`${facts.companyEmail} · ${new Date(facts.companyEmailVerifiedAt).toLocaleString()}`} />
        <Fact label="Email signal" value={facts.companyEmailFreeProvider ? "Free email provider" : facts.companyEmailWebsiteDomainMatch === false ? "Website domain differs" : "No negative domain signal"} />
        <Fact label="Phone (unverified)" value={facts.companyPhoneE164} />
        <Fact label="Website" value={facts.websiteOrigin} />
        <Fact label="Relationship / title" value={`${facts.relationship} · ${facts.currentJobTitle}`} />
        <Fact label="Authority explanation" value={facts.authorityExplanation} />
        <Fact label="Accuracy declared" value={new Date(facts.accuracyDeclaredAt).toLocaleString()} />
        <Fact label="Document consent" value={new Date(facts.documentConsentAt).toLocaleString()} />
        <Fact label="Policy version" value={facts.policyVersion} />
      </Box>
    </Paper>
  );
}
