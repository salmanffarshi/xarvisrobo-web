/**
 * create-admin — interactive CLI to create the first (and subsequent) staff
 * accounts. Run with: `pnpm create-admin`
 *
 * This is the ONLY way staff accounts are created (ADR-013 / A.4 Decision 2):
 * there is no bootstrap route, no seed-based admin, no UI path. The script is
 * committed; the users it creates live only in the database.
 *
 * It is idempotent-safe: it refuses to overwrite an existing account.
 */

import * as readline from "node:readline";
import { Prisma, type UserRole } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import {
  nameSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
} from "@/lib/validations/auth";

const STAFF_ROLES = ["ADMIN", "MANAGER", "ENGINEER", "QC", "SUPPORT"] as const;

// A single readline interface for the whole session. We consume its `line`
// events through a queue rather than calling `rl.question` sequentially: when
// stdin is piped, readline emits buffered lines faster than sequential
// questions can register handlers, and the extra lines would be lost. The queue
// decouples line arrival from prompt timing, so it works interactively AND when
// scripted/piped.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// readline's private echo hook isn't in the public types; we narrow to this
// shape to mask hidden prompts (suppress the echo of typed characters).
interface MutableInterface extends readline.Interface {
  _writeToOutput?(stringToWrite: string): void;
}

const lineQueue: string[] = [];
let pendingResolve: ((line: string) => void) | null = null;
let inputClosed = false;

rl.on("line", (line) => {
  if (pendingResolve) {
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve(line);
  } else {
    lineQueue.push(line);
  }
});
rl.on("close", () => {
  inputClosed = true;
  if (pendingResolve) {
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve("");
  }
});

function nextLine(): Promise<string> {
  const buffered = lineQueue.shift();
  if (buffered !== undefined) return Promise.resolve(buffered);
  if (inputClosed) return Promise.resolve("");
  return new Promise((resolve) => {
    pendingResolve = resolve;
  });
}

/** Ask a question and return the typed answer (echoed normally). */
function prompt(query: string): Promise<string> {
  process.stdout.write(query);
  return nextLine();
}

/**
 * Ask a question with the typed input hidden (echo suppressed, like `sudo`).
 * Interactive: mutes character echo. Piped: no echo to mute anyway.
 */
async function promptHidden(query: string): Promise<string> {
  process.stdout.write(query);

  const rlm = rl as MutableInterface;
  const originalWrite = rlm._writeToOutput?.bind(rlm);
  rlm._writeToOutput = (stringToWrite: string) => {
    if (stringToWrite.includes("\n") || stringToWrite.includes("\r")) {
      originalWrite?.(stringToWrite);
    }
  };

  const line = await nextLine();

  if (originalWrite) rlm._writeToOutput = originalWrite;
  process.stdout.write("\n");
  return line;
}

/** Prompt repeatedly until the answer passes the given schema. */
async function promptValidated<T>(
  query: string,
  schema: z.ZodType<T>,
  opts: { hidden?: boolean } = {}
): Promise<T> {
  for (;;) {
    const raw = opts.hidden ? await promptHidden(query) : await prompt(query);
    const result = schema.safeParse(raw);
    if (result.success) return result.data;
    console.error(`  ✗ ${result.error.issues[0]?.message ?? "Invalid input"}`);
  }
}

// Empty input → default ADMIN; otherwise must be one of the staff roles.
const roleSchema: z.ZodType<UserRole> = z.preprocess(
  (v) =>
    typeof v === "string" && v.trim() === ""
      ? "ADMIN"
      : String(v).trim().toUpperCase(),
  z.enum(STAFF_ROLES)
);

// Optional phone: blank is allowed; a non-empty value must be a valid BD number.
const optionalPhoneSchema: z.ZodType<string | undefined> = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  phoneSchema.optional()
);

async function main() {
  console.log("\n  Xarvisrobo — create a staff account\n");

  const name = await promptValidated("Name: ", nameSchema);
  const email = await promptValidated("Email: ", emailSchema);

  // Fail fast: never overwrite an existing account (idempotent-safe).
  const existing = await db.user.findUnique({
    where: { email },
    select: { role: true },
  });
  if (existing) {
    console.error(
      `\n  ✗ User already exists with role ${existing.role}. Refusing to overwrite.\n`
    );
    process.exitCode = 1;
    return;
  }

  const phone = await promptValidated(
    "Phone (optional, e.g. 01712345678): ",
    optionalPhoneSchema
  );
  const role = await promptValidated(
    `Role [${STAFF_ROLES.join(" | ")}] (default ADMIN): `,
    roleSchema
  );

  // Password + confirmation, both hidden. Re-ask until they match.
  let password: string;
  for (;;) {
    password = await promptValidated("Password: ", passwordSchema, {
      hidden: true,
    });
    const confirm = await promptHidden("Confirm password: ");
    if (confirm === password) break;
    console.error("  ✗ Passwords do not match. Try again.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await db.user.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        passwordHash,
        role,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    console.log(
      `\n  ✓ Created ${user.role} account for ${user.name} <${user.email}> (id: ${user.id})`
    );
    console.log(
      "\n  ⚠  Save this credential securely. The password cannot be recovered —\n" +
        "     it can only be reset via this CLI.\n"
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = error.meta?.target;
      const field =
        Array.isArray(target) && target.includes("phone") ? "phone" : "email";
      console.error(
        `\n  ✗ That ${field} is already in use. No account created.\n`
      );
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(
      `\n  ✗ ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await db.$disconnect();
  });
