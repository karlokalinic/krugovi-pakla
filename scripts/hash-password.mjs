import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Uporaba: npm run hash-password -- 'tvoja-jaka-lozinka'");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(`Sirovi hash (Vercel/Supabase nadzorna ploča):\n${hash}\n`);
console.log(`Za lokalni .env.local (znak $ mora biti escapiran):\nPILOT_PASSWORD_HASH=${hash.replaceAll("$", "\\$")}`);
