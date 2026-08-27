export type JobSearchTaxonomy = Readonly<{
  industries: ReadonlyArray<{
    code: string;
    name: string;
    count: number;
    subIndustries: ReadonlyArray<{
      /** Stable shared sub-industry code when one is available. */
      code?: string;
      name: string;
      count: number;
      titles: ReadonlyArray<{
        name: string;
        categoryIds: string[];
        count: number;
      }>;
    }>;
  }>;
  locations: ReadonlyArray<{
    label: string;
    value: string;
    count: number;
  }>;
  locationGroups?: ReadonlyArray<{
    city: string;
    count: number;
    districts: ReadonlyArray<{
      name: string;
      count: number;
    }>;
  }>;
}>;
