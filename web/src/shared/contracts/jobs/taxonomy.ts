export type JobSearchTaxonomy = Readonly<{
  industries: ReadonlyArray<{
    code: string;
    name: string;
    count: number;
    subIndustries: ReadonlyArray<{
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
}>;
