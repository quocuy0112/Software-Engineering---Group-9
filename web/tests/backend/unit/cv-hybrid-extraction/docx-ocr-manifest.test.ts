import { describe, expect, it } from "vitest";

import { inventoryDocxBodyImages } from "@/backend/cv/extraction/docx-ocr-manifest";

const relationships = `
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/poster.png"/>
  <Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.svg"/>
</Relationships>`;

describe("main-body DOCX image traversal", () => {
  it("places supported body images after the nearest deterministic paragraph", async () => {
    const documentXml = `
      <w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body>
        <w:p><w:r><w:t>Work experience</w:t></w:r></w:p>
        <w:p><w:r><w:drawing><a:blip r:embed="rId7"/></w:drawing></w:r></w:p>
      </w:body></w:document>`;
    const result = await inventoryDocxBodyImages({
      documentXml,
      relationshipsXml: relationships,
      inspectImage: async () => ({
        format: "png",
        width: 800,
        height: 600,
        normalizedPngPath: "C:/private/poster.png",
      }),
    });
    expect(result.units[0]).toMatchObject({
      classification: "ELIGIBLE_BODY_IMAGE",
      bodyOrdinal: 1,
      imageOrdinal: 0,
      anchorSegmentId: "docx-paragraph-1",
      anchorQuality: "EXACT",
    });
  });

  it("accounts for unsupported body images and enforces aggregate limits", async () => {
    const documentXml = `
      <w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body>
        <w:p><w:r><w:drawing><a:blip r:embed="rId8"/></w:drawing></w:r></w:p>
      </w:body></w:document>`;
    const result = await inventoryDocxBodyImages({
      documentXml,
      relationshipsXml: relationships,
      inspectImage: async () => ({
        format: "svg",
        width: 100,
        height: 100,
        normalizedPngPath: null,
      }),
    });
    expect(result.units[0]?.classification).toBe("EXCLUDED_UNSUPPORTED_IMAGE");

    const repeated = `<w:document xmlns:w="w" xmlns:a="a" xmlns:r="r"><w:body>${Array.from(
      { length: 21 },
      () => '<w:p><a:blip r:embed="rId7"/></w:p>',
    ).join("")}</w:body></w:document>`;
    await expect(
      inventoryDocxBodyImages({
        documentXml: repeated,
        relationshipsXml: relationships,
        inspectImage: async () => ({
          format: "png",
          width: 10,
          height: 10,
          normalizedPngPath: "C:/private/poster.png",
        }),
      }),
    ).rejects.toMatchObject({ code: "DOCX_IMAGE_LIMIT" });
  });
});
