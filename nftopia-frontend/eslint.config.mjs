import next from "eslint-config-next";

export default [
  next(),
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      // ✅ Best Practices
      "no-console": "warn", // Warns against console.log but doesn't break the build
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }], // Ignores unused vars prefixed with "_"
      "no-undef": "error", // Prevents using undefined variables
      
      // ✅ TypeScript Rules
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }], // TS version of unused-vars
      "@typescript-eslint/consistent-type-imports": "warn", // Enforces using `import type {...}`
      
      // ✅ React/Next.js Rules
      "react/react-in-jsx-scope": "off", // Not needed in Next.js
      "react/jsx-uses-react": "off", // Not needed in Next.js (React 18+)
      "react-hooks/rules-of-hooks": "error", // Enforces correct hooks usage
      "react-hooks/exhaustive-deps": "warn", // Warns about missing dependencies in useEffect

      // ✅ Accessibility (Optional but Recommended)
      "jsx-a11y/alt-text": "warn", // Ensures images have alt text
      "jsx-a11y/anchor-is-valid": "warn", // Ensures anchors are valid
      
      // ✅ Next.js-Specific Rules
      "@next/next/no-html-link-for-pages": "off", // Disable if using external links
      "@next/next/no-img-element": "off", // Disable if using `<img>` instead of `<Image>`

      // ✅ Code Formatting (Optional)
      "prettier/prettier": [
        "warn",
        {
          semi: false,
          singleQuote: true,
          trailingComma: "all",
        },
      ],
    },
  },
];
