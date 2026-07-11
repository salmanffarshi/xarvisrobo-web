// Admin customer management (Phase E.4 Part C, ADR-003). Staff-guarded at the
// route. Scoped strictly to CUSTOMER-role users: this tool can never read staff
// as "customers" nor deactivate a staff/admin account. No passwords are ever
// read or written here.

import type { OrderStatus, PaymentMethod } from "@prisma/client";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/permissions";
import {
  addNoteSchema,
  setActiveSchema,
  type AddNoteInput,
  type SetActiveInput,
} from "@/lib/validations/customer-admin";

export type CustomerSummary = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  orderCount: number;
};

export type CustomerOrderRow = {
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  total: string;
  itemCount: number;
};

export type CustomerNoteRow = {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  authorName: string;
};

export type CustomerDetail = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  orders: CustomerOrderRow[];
  notes: CustomerNoteRow[];
};

export type CustomerListResult = {
  data: CustomerSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const MAX_LIMIT = 50;

/** Thrown when a customer id doesn't exist (as a CUSTOMER). Mapped to 404. */
export class CustomerNotFoundError extends Error {
  readonly code = "CUSTOMER_NOT_FOUND";
  constructor() {
    super("Customer not found");
    this.name = "CustomerNotFoundError";
  }
}

/** Thrown when the customer tool targets a non-CUSTOMER account. Mapped to 403. */
export class NotACustomerError extends Error {
  readonly code = "NOT_A_CUSTOMER";
  constructor() {
    super("This account is not a customer and can't be managed here.");
    this.name = "NotACustomerError";
  }
}

/** Thrown when a note doesn't exist for this customer. Mapped to 404. */
export class NoteNotFoundError extends Error {
  readonly code = "NOTE_NOT_FOUND";
  constructor() {
    super("Note not found");
    this.name = "NoteNotFoundError";
  }
}

/** Thrown when deleting a note the actor neither authored nor may delete as
 * admin. Mapped to 403. */
export class NoteForbiddenError extends Error {
  readonly code = "NOTE_FORBIDDEN";
  constructor() {
    super("You can only delete your own notes.");
    this.name = "NoteForbiddenError";
  }
}

export interface CustomerFilters {
  search?: string;
  page?: number;
  limit?: number;
}

/** CUSTOMER-role users, newest first, paginated, each with their order count. */
export async function list(
  filters: CustomerFilters = {},
): Promise<CustomerListResult> {
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), MAX_LIMIT);
  const page = Math.max(filters.page ?? 1, 1);
  const search = filters.search?.trim();

  const where = {
    role: "CUSTOMER" as const,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);

  const data: CustomerSummary[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    orderCount: u._count.orders,
  }));

  return { data, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Customer profile + their orders (newest first) + their notes (newest first).
 * Returns null unless the id is a CUSTOMER-role user. */
export async function get(id: string): Promise<CustomerDetail | null> {
  const user = await db.user.findFirst({
    where: { id, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          orderNumber: true,
          createdAt: true,
          status: true,
          paymentMethod: true,
          total: true,
          items: { select: { quantity: true } },
        },
      },
      notesAboutMe: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          authorId: true,
          author: { select: { name: true } },
        },
      },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    orders: user.orders.map((o) => ({
      orderNumber: o.orderNumber,
      createdAt: o.createdAt.toISOString(),
      status: o.status,
      paymentMethod: o.paymentMethod,
      total: o.total.toFixed(2),
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    })),
    notes: user.notesAboutMe.map((n) => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
      authorId: n.authorId,
      authorName: n.author.name,
    })),
  };
}

/** Ensure the target id is a CUSTOMER; else throw. Returns the customer's id. */
async function requireCustomer(id: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!user) throw new CustomerNotFoundError();
  if (user.role !== "CUSTOMER") throw new NotACustomerError();
}

/** Add an internal note about a customer, attributed to the acting staff. */
export async function addNote(
  adminId: string,
  customerId: string,
  input: AddNoteInput,
): Promise<CustomerNoteRow> {
  const data = addNoteSchema.parse(input);
  await requireCustomer(customerId);

  const note = await db.customerNote.create({
    data: { customerId, authorId: adminId, content: data.content },
    select: {
      id: true,
      content: true,
      createdAt: true,
      authorId: true,
      author: { select: { name: true } },
    },
  });
  return {
    id: note.id,
    content: note.content,
    createdAt: note.createdAt.toISOString(),
    authorId: note.authorId,
    authorName: note.author.name,
  };
}

/** Delete a note — allowed to its author, or to any ADMIN. */
export async function deleteNote(
  adminId: string,
  customerId: string,
  noteId: string,
): Promise<void> {
  const note = await db.customerNote.findFirst({
    where: { id: noteId, customerId },
    select: { id: true, authorId: true },
  });
  if (!note) throw new NoteNotFoundError();

  if (note.authorId !== adminId) {
    const actor = await db.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });
    if (!actor || !isAdmin(actor.role)) throw new NoteForbiddenError();
  }

  await db.customerNote.delete({ where: { id: noteId } });
}

/** Toggle a customer's active flag. Never touches a staff/admin account. */
export async function setActive(
  adminId: string,
  customerId: string,
  input: SetActiveInput,
): Promise<void> {
  const data = setActiveSchema.parse(input);
  await requireCustomer(customerId);
  await db.user.update({
    where: { id: customerId },
    data: { isActive: data.isActive },
  });
}
