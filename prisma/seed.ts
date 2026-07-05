import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    specifications: {
      "Voice AI": "Xiaozhi-based voice assistant custom tuned.",
      Processor: "ESP32-S3",
      Movement: "No movement",
      Display: "0.96-inch OLED display",
      Battery: "2500 mAh, USB-C fast charge",
      Connectivity: "Wi-Fi 4, Bluetooth 5",
      Dimensions: "120 x 90 x 90",
      Weight: "220",
      Materials: "3D-printed PLA shell, aluminum base",
      Warranty: "12 months",
    },
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
    specifications: {
      "Voice AI": "Xiaozhi-based voice assistant custom tuned.",
      Processor: "ESP32-S3",
      Movement: "Servo neck, expressive",
      Display: "0.96-inch OLED display",
      Battery: "2500 mAh, USB-C fast charge",
      Connectivity: "Wi-Fi 4, Bluetooth 5",
      Dimensions: "120 x 90 x 90",
      Weight: "220",
      Materials: "3D-printed PLA shell, aluminum base",
      Warranty: "12 months",
    },
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

  console.log(
    `[seed] ${categories.length} categories, ${products.length} products seeded.`
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
