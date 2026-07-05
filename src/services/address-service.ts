// Address service — CRUD for a customer's saved addresses (Phase B.3).
//
// SECURITY CORE of this phase: every function that touches a specific address
// verifies ownership by querying with BOTH the address id AND the userId. An
// address that exists but belongs to someone else is indistinguishable from
// one that doesn't exist (null / NOT_FOUND) — so a customer can never read,
// edit, or delete another customer's address by guessing IDs.
//
// Default-address invariant: a user with addresses always has exactly one
// default. Enforced by: first address is forced default; setting a new default
// unsets the others in the same transaction; deleting the default promotes the
// most recently created remaining address.

import type { Address } from "@prisma/client";

import { db } from "@/lib/db";
import {
  addressSchema,
  createAddressSchema,
  type AddressInput,
  type CreateAddressInput,
} from "@/lib/validations/address";

/** Thrown when the address doesn't exist OR isn't owned by this user (the two
 * cases are deliberately indistinguishable). Mapped to HTTP 404 by the route. */
export class AddressNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor() {
    super("Address not found");
    this.name = "AddressNotFoundError";
  }
}

/** Ownership check: fetch only if the address belongs to userId, else throw. */
async function findOwned(userId: string, addressId: string): Promise<Address> {
  const address = await db.address.findFirst({
    where: { id: addressId, userId },
  });
  if (!address) {
    throw new AddressNotFoundError();
  }
  return address;
}

/** All of the user's addresses — default first, then newest first. */
export async function list(userId: string): Promise<Address[]> {
  return db.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

/** Single address, only if owned by userId. Null otherwise (route → 404). */
export async function get(
  userId: string,
  addressId: string
): Promise<Address | null> {
  return db.address.findFirst({ where: { id: addressId, userId } });
}

/**
 * Create an address. The user's first address is always the default; otherwise
 * an explicit `isDefault: true` demotes the previous default in the same
 * transaction so there's never a moment with two defaults.
 */
export async function create(
  userId: string,
  input: CreateAddressInput
): Promise<Address> {
  const data = createAddressSchema.parse(input);
  const existingCount = await db.address.count({ where: { userId } });
  const isDefault = existingCount === 0 || data.isDefault === true;

  if (isDefault && existingCount > 0) {
    const [, created] = await db.$transaction([
      db.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      db.address.create({ data: { ...data, userId, isDefault: true } }),
    ]);
    return created;
  }

  return db.address.create({ data: { ...data, userId, isDefault } });
}

/**
 * Update an owned address. Setting `isDefault: true` demotes the others in the
 * same transaction; omitting it leaves the default flag unchanged.
 */
export async function update(
  userId: string,
  addressId: string,
  input: AddressInput
): Promise<Address> {
  await findOwned(userId, addressId);
  const data = addressSchema.parse(input);

  if (data.isDefault === true) {
    const [, updated] = await db.$transaction([
      db.address.updateMany({
        where: { userId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      }),
      db.address.update({
        where: { id: addressId },
        data: { ...data, isDefault: true },
      }),
    ]);
    return updated;
  }

  return db.address.update({ where: { id: addressId }, data });
}

/**
 * Delete an owned address. If it was the default and other addresses remain,
 * the most recently created one is promoted to default in the same transaction
 * (checkout must always have a default to preselect).
 */
export async function remove(userId: string, addressId: string): Promise<void> {
  const address = await findOwned(userId, addressId);

  if (!address.isDefault) {
    await db.address.delete({ where: { id: addressId } });
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: addressId } });
    const newest = await tx.address.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (newest) {
      await tx.address.update({
        where: { id: newest.id },
        data: { isDefault: true },
      });
    }
  });
}

/** Make an owned address the default, demoting all others in one transaction. */
export async function setDefault(
  userId: string,
  addressId: string
): Promise<Address> {
  await findOwned(userId, addressId);

  const [, updated] = await db.$transaction([
    db.address.updateMany({
      where: { userId, isDefault: true, id: { not: addressId } },
      data: { isDefault: false },
    }),
    db.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    }),
  ]);
  return updated;
}
