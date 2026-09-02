import { prisma } from "@/lib/prisma";

export async function getFormBySlug(slug: string) {
  try {
    return await prisma.form.findUnique({
      where: { slug },
      include: { fields: { where: { archivedAt: null }, orderBy: { order: "asc" } } },
    });
  } catch {
    return null;
  }
}
