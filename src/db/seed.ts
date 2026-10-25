import "dotenv/config";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "./schema";

type Item = [title: string, price: number, unit?: string, note?: string, history?: number[]];

// Data taken from the shop's current price posters. `history` = older prices (oldest first)
// so the trend arrows have something to show right after seeding.
const CATALOG: { main: string; subs: { name: string; items: Item[] }[] }[] = [
  {
    main: "บอร์ด",
    subs: [
      {
        name: "บอร์ดอิเล็กทรอนิกส์",
        items: [
          ["บอร์ด-2ชิป+การ์ดจอ", 570, "กก.", undefined, [550, 560]],
          ["บอร์ด-1 ชิป", 350, "กก.", undefined, [370]],
          ["บอร์ด-No ชิป", 250, "กก."],
          ["บอร์ด-รอง", 380, "กก.", undefined, [360]],
          ["บอร์ด-รองC", 275, "กก."],
          ["บอร์ด-เร้าเตอร์", 200, "กก.", undefined, [210]],
          ["บอร์ด-ไม้บรรทัด+cof", 720, "กก.", undefined, [700]],
          ["บอร์ด-โน๊ตบุ๊ค", 720, "กก."],
          ["บอร์ด CD ROM", 720, "กก."],
          ["บอร์ด-รอง แต้มทอง", 500, "กก.", undefined, [480]],
          ["บอร์ด-พาวเวอร์เขียว", 130, "กก."],
          ["บอร์ด-พาวเวอร์น้ำตาล", 70, "กก.", undefined, [75]],
          ["บอร์ด-TV เต็ม", 85, "กก."],
          ["บอร์ด-ขยะ", 60, "กก."],
          ["บอร์ด-มือถือ", 1600, "กก.", undefined, [1500, 1550]],
          ["เบรกเกอร์", 160, "กก."],
          ["เซอร์กิต-หัวปลั๊ก", 30, "กก."],
        ],
      },
      {
        name: "ชิ้นส่วนคอมพิวเตอร์",
        items: [
          ["แรมบาง", 3500, "กก.", undefined, [3300]],
          ["แรมหนา", 1500, "กก."],
          ["CPU เขียว", 1000, "กก."],
          ["CPU เขียวเบา", 2000, "กก.", undefined, [2100]],
          ["CPU ทองคำ", 3000, "กก.", "3000-30000"],
          ["ซากโน๊ตบุ๊ค แกะแบต", 150, "กก."],
          ["ฮาร์ดดิสก์", 150, "กก."],
          ["บอร์ด-ฮาร์ดดิสก์", 1700, "กก.", undefined, [1650]],
          ["ไอซี ตะขาบ", 1000, "กก."],
          ["ไอซี ขารอบ", 5000, "กก.", undefined, [5200]],
          ["ไอซี 3ขา,ดีเลย์", 250, "กก."],
          ["ดีเลย์ รถยนต์", 60, "กก."],
          ["แผ่น ซีดี", 20, "กก."],
          ["CD ROM", 40, "ตัว"],
          ["PW-BOX", 60, "ตัว"],
          ["PW-สาย", 110, "กก."],
          ["สายไฟรวม", 85, "กก.", undefined, [80]],
          ["สายแลนด์", 120, "กก."],
        ],
      },
    ],
  },
  {
    main: "เครื่องใช้ไฟฟ้า",
    subs: [
      {
        name: "ทีวี & จอ",
        items: [
          ['ทีวี 14"', 120, "เครื่อง"],
          ['ทีวี 21" จีน', 100, "เครื่อง"],
          ['ทีวี 21"', 185, "เครื่อง", undefined, [180]],
          ['ทีวี 25"', 190, "เครื่อง"],
          ['ทีวี 29"', 220, "เครื่อง", undefined, [230]],
          ['ทีวี 29" จีน', 130, "เครื่อง"],
          ["จอคอม CRT", 185, "เครื่อง"],
          ["จอคอม แบน", 50, "เครื่อง"],
          ['จอแบน 32"+', 100, "เครื่อง", "100+"],
        ],
      },
      {
        name: "เครื่องใช้ไฟฟ้าในบ้าน",
        items: [
          ["พัดลม ครบ", 40, "ตัว"],
          ["ตู้เย็น 1ประตู ครบ", 600, "เครื่อง", undefined, [580]],
          ["ตู้เย็น 2ประตู ครบ", 650, "เครื่อง"],
          ["เครื่องซักผ้าฝาบน", 500, "เครื่อง"],
          ["เครื่องซักผ้า ฝาหน้า", 450, "เครื่อง", undefined, [470]],
          ["เครื่องซักผ้า 2ถัง", 500, "เครื่อง"],
          ["ไมโครเวฟ", 110, "เครื่อง"],
          ["CPU ครบ", 400, "เครื่อง"],
          ["มือถือ", 15, "เครื่อง", "15-100+"],
          ["แทปเลต", 40, "เครื่อง"],
        ],
      },
    ],
  },
];

const UNITS = ["กก.", "ชิ้น", "ตัว", "เครื่อง", "เส้น", "ลัง", "ตัน"];

const SETTINGS: Record<string, string> = {
  shop_name: "ร้าน บุญมี รีไซเคิล",
  phones: "063-727-5142, 096-772-2504",
  tagline: "เครื่องใช้ไฟฟ้าเก่า-เสีย งานแกะ และ บอร์ดอิเล็กทรอนิกส์ทุกชนิด",
  open_hours: "ร้านเปิด วันจันทร์-วันเสาร์ เวลา 8:00น. - 17:00น.",
  line_url: "https://line.me/R/ti/p/~boonmee-recycle",
  website: "boonmee-recycle.cc",
};

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema: s });
  const force = process.argv.includes("--force");

  const existing = await db.select({ id: s.mainCategories.id }).from(s.mainCategories).limit(1);
  if (existing.length && !force) {
    console.log("Database already has data — skipping catalog seed (use --force to wipe & reseed).");
  } else {
    await client`TRUNCATE price_history, products, sub_categories, main_categories, units RESTART IDENTITY CASCADE`;

    const unitRows = await db
      .insert(s.units)
      .values(UNITS.map((name, i) => ({ name, sortOrder: i })))
      .returning();
    const unitId = (name?: string) => unitRows.find((u) => u.name === name)?.id ?? null;

    let productCount = 0;
    for (const [mi, cat] of CATALOG.entries()) {
      const [main] = await db
        .insert(s.mainCategories)
        .values({ name: cat.main, sortOrder: mi })
        .returning();
      for (const [si, sub] of cat.subs.entries()) {
        const [subRow] = await db
          .insert(s.subCategories)
          .values({ mainCategoryId: main.id, name: sub.name, sortOrder: si })
          .returning();
        for (const [pi, [title, price, unit, note, history = []]] of sub.items.entries()) {
          const [p] = await db
            .insert(s.products)
            .values({
              subCategoryId: subRow.id,
              title,
              price,
              priceNote: note ?? null,
              unitId: unitId(unit),
              sortOrder: pi,
            })
            .returning();
          // build a dated history chain: first price → ... → current
          const chain = [...history, price];
          const now = Date.now();
          for (let i = 0; i < chain.length; i++) {
            const daysAgo = (chain.length - 1 - i) * 7 + 1;
            await db.insert(s.priceHistory).values({
              productId: p.id,
              oldPrice: i === 0 ? null : chain[i - 1],
              newPrice: chain[i],
              changedAt: new Date(now - daysAgo * 86400000 - (i === 0 ? 30 * 86400000 : 0)),
            });
          }
          productCount++;
        }
      }
    }
    console.log(`✔ seeded ${UNITS.length} units, ${CATALOG.length} main categories, ${productCount} products`);
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.insert(s.settings).values({ key, value }).onConflictDoNothing();
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin1234";
  const inserted = await db
    .insert(s.users)
    .values({ username, displayName: "ผู้ดูแลระบบ", passwordHash: await bcrypt.hash(password, 12) })
    .onConflictDoNothing()
    .returning();
  console.log(inserted.length ? `✔ admin user "${username}" created` : `• admin user "${username}" exists`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
