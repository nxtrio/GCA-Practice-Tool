export const problemSignatureShapeMigration = {
  version: 2,
  name: "problem_signature_shape",
  sql: `
    ALTER TABLE problem_catalog
      ADD COLUMN signature_shape TEXT NOT NULL DEFAULT '';
  `,
} as const;
