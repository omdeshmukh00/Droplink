import { google } from "googleapis";
import open from "open";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

const REDIRECT_URI = "http://localhost";

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error("Missing GOOGLE_DRIVE_CLIENT_ID or GOOGLE_DRIVE_CLIENT_SECRET in .env");
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
];

async function main() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("\nOpen this URL if it doesn't open automatically:\n");
  console.log(authUrl);

  await open(authUrl);

  const rl = readline.createInterface({
    input: stdin,
    output: stdout,
  });

  const code = await rl.question("\nPaste the authorization code here:\n");

  rl.close();

  const { tokens } = await oauth2Client.getToken(code);

  console.log("\n====================================");
  console.log("REFRESH TOKEN");
  console.log("====================================");
  console.log(tokens.refresh_token);
  console.log("====================================");
}

main().catch(console.error);