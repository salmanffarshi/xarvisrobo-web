// POST /api/v1/admin/products/:id/images — attach an image URL (already uploaded
// to Cloudinary via the signed products-folder endpoint). Staff-only.

import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/auth-guards";
import { PRODUCT_IMAGES_FOLDER, isOwnCloudinaryUrl } from "@/lib/cloudinary";
import { productErrorResponse } from "@/lib/product-admin-errors";
import { addImageSchema } from "@/lib/validations/product";
import { addImage } from "@/services/product-admin-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteContext) {
  const guard = await requireStaff();
  if (guard.response) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = addImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Please check the image and try again.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  // Re-validate the URL is on our cloud + products folder before storing it —
  // a client must not hand us an arbitrary or off-cloud URL.
  if (!isOwnCloudinaryUrl(parsed.data.url, PRODUCT_IMAGES_FOLDER)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_IMAGE_URL",
          message: "Image must be uploaded through the product image uploader.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const image = await addImage(id, parsed.data);
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    return productErrorResponse(error);
  }
}
