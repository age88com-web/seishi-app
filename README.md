This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Tests

テスト用フレームワークは未導入。`tests/` 配下のスクリプトを `npx tsx` で直接実行する（詳細は [`tests/README.md`](./tests/README.md)）。

```bash
# 奇門遁甲 排盤エンジンの 1080局 完全一致 回帰テスト
npx tsx tests/qimen_1080.manual.ts
```

`1080 / 1080 PASS`（exit 0）なら成功。1件でも不一致なら局番号・項目・期待値・実測値を表示して exit 1。
検証データ `tests/fixtures/qimen1080.json` は `docs/source/1080.pdf` からの機械転記であり、検証専用（仕様ではない）。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
