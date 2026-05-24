/**
 * Set R2 bucket CORS via S3-compatible API (no wrangler / browser login).
 * Run on EC2: node scripts/setupR2Cors.js
 */
require("dotenv").config();

const { PutBucketCorsCommand, GetBucketCorsCommand } = require("@aws-sdk/client-s3");

const r2 = require("../config/r2");
const bucket = process.env.R2_BUCKET_NAME;

const CORS_RULES = {
  CORSRules: [
    {
      AllowedHeaders: ["Content-Type", "Content-Length", "Range", "*"],
      AllowedMethods: ["GET", "HEAD", "PUT"],
      AllowedOrigins: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://admin.vikashtechsolution.com",
        "https://lms.vikashtechsolution.com",
        "https://course.vikashtechsolution.com",
      ],
      ExposeHeaders: ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
      MaxAgeSeconds: 3600,
    },
  ],
};

async function main() {
  if (!bucket) {
    console.error("R2_BUCKET_NAME is not set in .env");
    process.exit(1);
  }

  console.log(`Setting CORS on bucket "${bucket}"…`);

  await r2.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: CORS_RULES,
    })
  );

  const current = await r2.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log("CORS applied successfully:");
  console.log(JSON.stringify(current.CORSRules, null, 2));
}

main().catch((err) => {
  console.error("Failed to set CORS:", err.message || err);
  console.error(
    "\nIf this fails, use the Cloudflare Dashboard instead:\n" +
      "  R2 → online-course → Settings → CORS policy → paste from r2-cors.json\n" +
      "  (convert to dashboard format — see README in scripts/)"
  );
  process.exit(1);
});
