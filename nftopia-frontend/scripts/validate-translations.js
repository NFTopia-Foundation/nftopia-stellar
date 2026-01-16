#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Read translation files
const enPath = path.join(__dirname, "../locales/en/common.json");
const frPath = path.join(__dirname, "../locales/fr/common.json");

function flattenObject(obj, prefix = "") {
  const flattened = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        Object.assign(flattened, flattenObject(obj[key], newKey));
      } else {
        flattened[newKey] = obj[key];
      }
    }
  }

  return flattened;
}

function validateTranslations() {
  try {
    const enCommon = JSON.parse(fs.readFileSync(enPath, "utf8"));
    const frCommon = JSON.parse(fs.readFileSync(frPath, "utf8"));

    const enFlat = flattenObject(enCommon);
    const frFlat = flattenObject(frCommon);

    const missingKeys = [];
    const inconsistentTypes = [];
    const emptyValues = [];

    // Check for missing keys in French
    for (const key in enFlat) {
      if (!(key in frFlat)) {
        missingKeys.push(key);
      }
    }

    // Check for missing keys in English
    for (const key in frFlat) {
      if (!(key in enFlat)) {
        missingKeys.push(key);
      }
    }

    // Check for type inconsistencies
    for (const key in enFlat) {
      if (key in frFlat) {
        const enType = typeof enFlat[key];
        const frType = typeof frFlat[key];

        if (enType !== frType) {
          inconsistentTypes.push(`${key}: en(${enType}) vs fr(${frType})`);
        }
      }
    }

    // Check for empty values
    for (const key in enFlat) {
      if (
        enFlat[key] === "" ||
        enFlat[key] === null ||
        enFlat[key] === undefined
      ) {
        emptyValues.push(`en.${key}`);
      }
    }

    for (const key in frFlat) {
      if (
        frFlat[key] === "" ||
        frFlat[key] === null ||
        frFlat[key] === undefined
      ) {
        emptyValues.push(`fr.${key}`);
      }
    }

    // Log results
    console.log("🔍 Translation Validation Results:");
    console.log("=====================================");

    const isValid = missingKeys.length === 0 && inconsistentTypes.length === 0;

    if (isValid) {
      console.log("✅ All translations are valid!");
    } else {
      console.log("❌ Translation validation failed:");

      if (missingKeys.length > 0) {
        console.log("\n🚫 Missing keys:");
        missingKeys.forEach((key) => console.log(`  - ${key}`));
      }

      if (inconsistentTypes.length > 0) {
        console.log("\n⚠️  Type inconsistencies:");
        inconsistentTypes.forEach((inconsistency) =>
          console.log(`  - ${inconsistency}`)
        );
      }

      if (emptyValues.length > 0) {
        console.log("\n⚠️  Empty values:");
        emptyValues.forEach((value) => console.log(`  - ${value}`));
      }
    }

    console.log("\n📊 Summary:");
    console.log(`  - Total keys in English: ${Object.keys(enFlat).length}`);
    console.log(`  - Total keys in French: ${Object.keys(frFlat).length}`);
    console.log(`  - Missing keys: ${missingKeys.length}`);
    console.log(`  - Type inconsistencies: ${inconsistentTypes.length}`);
    console.log(`  - Empty values: ${emptyValues.length}`);

    // Exit with error code if validation failed
    if (!isValid) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error reading translation files:", error.message);
    process.exit(1);
  }
}

// Run validation
validateTranslations();
