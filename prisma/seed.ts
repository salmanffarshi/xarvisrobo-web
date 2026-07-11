import { PrismaClient } from "@prisma/client";

import {
  COD_DELIVERY_INSIDE_DHAKA,
  COD_DELIVERY_OUTSIDE_DHAKA,
  WHATSAPP_NUMBER,
  paymentGeneralNote,
  paymentReceivingDetails,
} from "../src/config/payment";

const prisma = new PrismaClient();

// The single Settings row (id="singleton"), seeded from the config defaults so
// the DB-backed values match what the site used before Phase E.4. Idempotent
// and non-destructive: `create` runs only on a fresh DB; on a re-seed the
// `update` is a no-op, so admin edits made through the Settings page survive.
const settingsDefaults = {
  bkashNumber: paymentReceivingDetails.BKASH.number,
  bkashType: paymentReceivingDetails.BKASH.accountType,
  bkashInstructions: paymentReceivingDetails.BKASH.instructions ?? null,
  nagadNumber: paymentReceivingDetails.NAGAD.number,
  nagadType: paymentReceivingDetails.NAGAD.accountType,
  nagadInstructions: paymentReceivingDetails.NAGAD.instructions ?? null,
  whatsappNumber: WHATSAPP_NUMBER,
  codInsideDhaka: COD_DELIVERY_INSIDE_DHAKA,
  codOutsideDhaka: COD_DELIVERY_OUTSIDE_DHAKA,
  paymentGeneralNote,
};

const categories = [
  {
    name: "Desk Robots",
    slug: "desk-robots",
    description: "Small AI-enabled companion robots for your workspace.",
    sortOrder: 1,
  },
  {
    name: "Accessories",
    slug: "accessories",
    description:
      "Add-ons, sensors, and expansion modules for Xarvisrobo robots.",
    sortOrder: 2,
  },
];

const products = [
  {
    name: "Xarvis D1",
    slug: "xarvis-d1",
    sku: "XR-D1-001",
    shortDescription:
      "AI-powered desktop assistant robot for learning, productivity, and everyday interaction.",
    description: `Xarvisrobo Desk One is a compact desktop AI assistant designed to make technology more interactive and accessible. Built around the ESP32-S3 platform, it combines voice interaction and modular hardware in a compact form suitable for desks, classrooms, and workspaces.

The robot is designed with future expansion in mind. Its modular architecture supports firmware updates, additional sensors, and mobile app integration as new capabilities are developed. The first release focuses on providing a reliable hardware platform that can continuously evolve through software updates.

Whether used for learning, experimentation, or as a personal desktop companion, Xarvis D1 reflects our goal of creating practical robotics products that are affordable, customizable, and easy to expand.`,
    basePrice: "2999.00",
    stockQuantity: 5,
    isActive: true,
    isFeatured: true,
    categorySlug: "desk-robots",
    specifications: [
      { label: "Voice AI", value: "Xiaozhi-based voice assistant custom tuned." },
      { label: "Processor", value: "ESP32-S3" },
      { label: "Movement", value: "No movement" },
      { label: "Display", value: "0.96-inch OLED display" },
      { label: "Battery", value: "2500 mAh, USB-C fast charge" },
      { label: "Connectivity", value: "Wi-Fi 4, Bluetooth 5" },
      { label: "Dimensions", value: "120 x 90 x 90" },
      { label: "Weight", value: "220" },
      { label: "Materials", value: "3D-printed PLA shell, aluminum base" },
      { label: "Warranty", value: "12 months" },
    ],
  },
  {
    name: "Xarvis D2",
    slug: "xarvis-d2",
    sku: "XR-D2-001",
    shortDescription:
      "AI-powered desktop assistant robot for learning, productivity, and everyday interaction.",
    description: `Xarvisrobo Desk One is a compact desktop AI assistant designed to make technology more interactive and accessible. Built around the ESP32-S3 platform, it combines voice interaction, expressive movement, and modular hardware in a compact form suitable for desks, classrooms, and workspaces.

The robot is designed with future expansion in mind. Its modular architecture supports firmware updates, additional sensors, and mobile app integration as new capabilities are developed. The first release focuses on providing a reliable hardware platform that can continuously evolve through software updates.

Whether used for learning, experimentation, or as a personal desktop companion, Xarvis D2 reflects our goal of creating practical robotics products that are affordable, customizable, and easy to expand.`,
    basePrice: "3999.00",
    stockQuantity: 5,
    isActive: true,
    isFeatured: true,
    categorySlug: "desk-robots",
    specifications: [
      { label: "Voice AI", value: "Xiaozhi-based voice assistant custom tuned." },
      { label: "Processor", value: "ESP32-S3" },
      { label: "Movement", value: "Servo neck, expressive" },
      { label: "Display", value: "0.96-inch OLED display" },
      { label: "Battery", value: "2500 mAh, USB-C fast charge" },
      { label: "Connectivity", value: "Wi-Fi 4, Bluetooth 5" },
      { label: "Dimensions", value: "120 x 90 x 90" },
      { label: "Weight", value: "220" },
      { label: "Materials", value: "3D-printed PLA shell, aluminum base" },
      { label: "Warranty", value: "12 months" },
    ],
  },
];

async function main() {
  const categoryIdBySlug = new Map<string, string>();

  for (const category of categories) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: category,
    });
    categoryIdBySlug.set(row.slug, row.id);
  }

  for (const product of products) {
    const { categorySlug, ...data } = product;
    const categoryId = categoryIdBySlug.get(categorySlug);
    if (!categoryId) {
      throw new Error(
        `[seed] Product "${product.name}" references unknown category slug "${categorySlug}"`
      );
    }
    await prisma.product.upsert({
      where: { slug: data.slug },
      create: { ...data, categoryId },
      update: { ...data, categoryId },
    });
  }

  await prisma.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...settingsDefaults },
    update: {},
  });

  console.log(
    `[seed] ${categories.length} categories, ${products.length} products, 1 settings row seeded.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
