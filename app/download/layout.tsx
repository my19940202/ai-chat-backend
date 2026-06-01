import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Link | 下载与套餐",
  description:
    "AI Link 帮你以更低成本访问 DeepSeek、ChatGPT、Claude、Gemini 等海外大模型。支持 PWA 直接访问与安卓 APK 下载。",
  openGraph: {
    title: "AI Link | 下载与套餐",
    description:
      "低成本使用海外 AI，免登录即可体验 DeepSeek，登录后解锁更多模型。",
    locale: "zh_CN",
    type: "website",
  },
};

export default function DownloadLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
