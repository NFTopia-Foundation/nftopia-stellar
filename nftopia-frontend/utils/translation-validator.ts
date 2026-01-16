import enCommon from "@/locales/en/common.json";
import frCommon from "@/locales/fr/common.json";

interface TranslationValidationResult {
  missingKeys: string[];
  inconsistentTypes: string[];
  emptyValues: string[];
  isValid: boolean;
}

function flattenObject(obj: any, prefix = ""): Record<string, any> {
  const flattened: Record<string, any> = {};

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

function getObjectType(value: any): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function validateTranslations(): TranslationValidationResult {
  const enFlat = flattenObject(enCommon);
  const frFlat = flattenObject(frCommon);

  const result: TranslationValidationResult = {
    missingKeys: [],
    inconsistentTypes: [],
    emptyValues: [],
    isValid: true,
  };

  // Check for missing keys in French
  for (const key in enFlat) {
    if (!(key in frFlat)) {
      result.missingKeys.push(key);
      result.isValid = false;
    }
  }

  // Check for missing keys in English
  for (const key in frFlat) {
    if (!(key in enFlat)) {
      result.missingKeys.push(key);
      result.isValid = false;
    }
  }

  // Check for type inconsistencies
  for (const key in enFlat) {
    if (key in frFlat) {
      const enType = getObjectType(enFlat[key]);
      const frType = getObjectType(frFlat[key]);

      if (enType !== frType) {
        result.inconsistentTypes.push(`${key}: en(${enType}) vs fr(${frType})`);
        result.isValid = false;
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
      result.emptyValues.push(`en.${key}`);
    }
  }

  for (const key in frFlat) {
    if (
      frFlat[key] === "" ||
      frFlat[key] === null ||
      frFlat[key] === undefined
    ) {
      result.emptyValues.push(`fr.${key}`);
    }
  }

  return result;
}

export function logValidationResults(): void {
  const result = validateTranslations();

  console.log("🔍 Translation Validation Results:");
  console.log("=====================================");

  if (result.isValid) {
    console.log("✅ All translations are valid!");
  } else {
    console.log("❌ Translation validation failed:");

    if (result.missingKeys.length > 0) {
      console.log("\n🚫 Missing keys:");
      result.missingKeys.forEach((key) => console.log(`  - ${key}`));
    }

    if (result.inconsistentTypes.length > 0) {
      console.log("\n⚠️  Type inconsistencies:");
      result.inconsistentTypes.forEach((inconsistency) =>
        console.log(`  - ${inconsistency}`)
      );
    }

    if (result.emptyValues.length > 0) {
      console.log("\n⚠️  Empty values:");
      result.emptyValues.forEach((value) => console.log(`  - ${value}`));
    }
  }

  console.log("\n📊 Summary:");
  console.log(
    `  - Total keys in English: ${Object.keys(flattenObject(enCommon)).length}`
  );
  console.log(
    `  - Total keys in French: ${Object.keys(flattenObject(frCommon)).length}`
  );
  console.log(`  - Missing keys: ${result.missingKeys.length}`);
  console.log(`  - Type inconsistencies: ${result.inconsistentTypes.length}`);
  console.log(`  - Empty values: ${result.emptyValues.length}`);
}

// Export for use in scripts
if (typeof window === "undefined") {
  // Only run in Node.js environment
  logValidationResults();
}
