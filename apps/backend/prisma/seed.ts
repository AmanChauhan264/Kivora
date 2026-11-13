import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CategorySeed {
  name: string;
  slug: string;
  description: string;
  commissionRate: number;
  children?: Omit<CategorySeed, 'children'>[];
}

const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    name: "Men's Fashion",
    slug: 'mens-fashion',
    description: 'Curated menswear, handcrafted footwear, and refined artisan accessories',
    commissionRate: 12.0,
    children: [
      {
        name: 'Footwear & Loafers',
        slug: 'mens-footwear',
        description: 'Handcrafted leather loafers, boots, and casual shoes',
        commissionRate: 12.0,
      },
      {
        name: 'Apparel & Outerwear',
        slug: 'mens-apparel',
        description: 'Linen shirts, bespoke suits, and fine outerwear',
        commissionRate: 10.0,
      },
      {
        name: 'Accessories & Leather Goods',
        slug: 'mens-accessories',
        description: 'Full-grain leather belts, wallets, and watches',
        commissionRate: 15.0,
      },
    ],
  },
  {
    name: "Women's Fashion",
    slug: 'womens-fashion',
    description: 'Artisan handloom sarees, designer western wear, and handcrafted jewelry',
    commissionRate: 12.0,
    children: [
      {
        name: 'Handloom & Ethnic Wear',
        slug: 'womens-ethnic-wear',
        description: 'Silk sarees, chanderi suits, and hand-embroidered kurtas',
        commissionRate: 10.0,
      },
      {
        name: 'Designer Western Wear',
        slug: 'womens-western-wear',
        description: 'Dresses, shirts, and modern tailored trousers',
        commissionRate: 12.0,
      },
      {
        name: 'Fine Artisan Jewelry',
        slug: 'womens-jewelry',
        description: 'Sterling silver, temple jewelry, and brass statement pieces',
        commissionRate: 15.0,
      },
    ],
  },
  {
    name: 'Home & Living',
    slug: 'home-and-living',
    description: 'Handmade pottery, woven rugs, and ambient artisan decor',
    commissionRate: 10.0,
    children: [
      {
        name: 'Artisan Ceramics & Pottery',
        slug: 'artisan-ceramics',
        description: 'Studio pottery, dinnerware, and stoneware vases',
        commissionRate: 10.0,
      },
      {
        name: 'Handwoven Rugs & Textiles',
        slug: 'handwoven-rugs',
        description: 'Dhurries, kilims, and organic cotton throws',
        commissionRate: 12.0,
      },
    ],
  },
  {
    name: 'Artisanal Gourmet',
    slug: 'artisanal-gourmet',
    description: 'Single-origin coffees, organic teas, and small-batch preserves',
    commissionRate: 8.0,
    children: [
      {
        name: 'Estate Teas & Coffees',
        slug: 'estate-teas-coffees',
        description: 'Darjeeling loose leaf, Assam black, and Araku valley beans',
        commissionRate: 8.0,
      },
      {
        name: 'Craft Preserves & Honey',
        slug: 'craft-preserves',
        description: 'Raw forest honey, organic jams, and stone-ground spices',
        commissionRate: 8.0,
      },
    ],
  },
];

export async function seedCategories(): Promise<number> {
  let seededCount = 0;

  for (const cat of DEFAULT_CATEGORIES) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        commissionRate: cat.commissionRate,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        commissionRate: cat.commissionRate,
        isActive: true,
      },
    });
    seededCount++;

    if (cat.children && cat.children.length > 0) {
      for (const child of cat.children) {
        await prisma.category.upsert({
          where: { slug: child.slug },
          update: {
            name: child.name,
            description: child.description,
            commissionRate: child.commissionRate,
            parentId: parent.id,
          },
          create: {
            name: child.name,
            slug: child.slug,
            description: child.description,
            commissionRate: child.commissionRate,
            parentId: parent.id,
            isActive: true,
          },
        });
        seededCount++;
      }
    }
  }

  return seededCount;
}

async function main() {
  // eslint-disable-next-line no-console
  console.info('Seeding Kivora marketplace default taxonomy...');
  const count = await seedCategories();
  // eslint-disable-next-line no-console
  console.info(`✓ Successfully seeded/upserted ${count} categories idempotently.`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error('Seed execution error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
