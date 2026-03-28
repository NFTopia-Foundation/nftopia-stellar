import type { CodegenConfig } from "@graphql-codegen/cli";

const schemaSource =
  process.env.GRAPHQL_SCHEMA_URL || "lib/graphql/schema.graphql";

const config: CodegenConfig = {
  overwrite: true,
  schema: schemaSource,
  documents: ["lib/graphql/**/*.{ts,tsx,graphql}"],
  ignoreNoDocuments: true,
  generates: {
    "hooks/graphql/generated.ts": {
      plugins: ["typescript", "typescript-operations", "typescript-react-apollo"],
      config: {
        withHooks: true,
        withHOC: false,
        withComponent: false,
        reactApolloVersion: 3,
      },
    },
  },
};

export default config;
