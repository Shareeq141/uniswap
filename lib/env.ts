import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({
      message: "NEXT_PUBLIC_SUPABASE_URL is required but was not found.",
    })
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase project URL (e.g., https://your-project.supabase.co)."),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({
      message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required but was not found.",
    })
    .min(10, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is too short to be a valid Supabase key."),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url("NEXT_PUBLIC_SITE_URL must be a valid absolute URL.")
    .optional(),
});

function getValidatedEnv() {
  const envValues = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };

  const parsed = envSchema.safeParse(envValues);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    const message = `
[UniSwap Configuration Warning]
Missing or invalid environment variables:
${errorDetails}

Please configure your .env.local file.
Refer to .env.example for required variables.
`;

    if (process.env.NODE_ENV !== "test") {
      console.warn(message);
    }

    return {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      isConfigured: false,
    };
  }

  return {
    ...parsed.data,
    isConfigured: true,
  };
}

export const env = getValidatedEnv();
