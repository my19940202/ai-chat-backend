import {
  Check,
  ExternalLink,
  Globe,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";

const PWA_URL = "https://ai.aizeten.me/";
const APK_URL =
  "https://6368-chengduzhubai-7gfjf95z068b991b-1352445637.tcb.qcloud.la/apk/app-release.apk";

const FEATURES = [
  "免登录即可使用 DeepSeek 智能对话",
  "登录后解锁 ChatGPT、Claude、Gemini、Grok",
  "统一接入海外模型，低成本按需使用",
];

const PLANS = [
  {
    tier: "free",
    name: "Free",
    price: "¥0",
    accentColor: "#9CA3AF",
    standardQuota: "每日 10 次访问普通模型",
    standardModels: [
      "Gemini 3 Flash",
      "GPT-5.4 mini",
      "Claude 4.5 Haiku",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: "¥19.9/月",
    priceNote: "扫码联系管理员开通",
    accentColor: "#208AEF",
    standardQuota: "每月 2,000 次访问普通模型",
    premiumQuota: "每月 100 次访问高级模型",
    standardModels: [
      "Gemini 3 Flash",
      "GPT-5.4 mini",
      "Claude 4.5 Haiku",
    ],
    premiumModels: ["GPT-5.5", "Claude 4.6 Sonnet", "Gemini 3.1 Pro"],
    highlighted: true,
  },
  {
    tier: "max",
    name: "Max",
    price: "¥49.9/月",
    priceNote: "扫码联系管理员开通",
    accentColor: "#FFCC33",
    standardQuota: "无限访问普通模型",
    premiumQuota: "无限访问高级模型",
    standardModels: [
      "Gemini 3 Flash",
      "GPT-5.4 mini",
      "Claude 4.5 Haiku",
    ],
    premiumModels: ["GPT-5.5", "Claude 4.6 Sonnet", "Gemini 3.1 Pro"],
  },
] as const;

const MODELS = [
  { name: "DeepSeek", color: "bg-blue-500" },
  { name: "ChatGPT", color: "bg-emerald-500" },
  { name: "Claude", color: "bg-orange-400" },
  { name: "Gemini", color: "bg-sky-400" },
  { name: "Grok", color: "bg-zinc-700" },
];

function PlanCard({
  plan,
}: {
  plan: (typeof PLANS)[number];
}) {
  return (
    <div
      className={`relative flex flex-col rounded-3xl border bg-white/80 p-6 shadow-sm backdrop-blur-sm transition hover:shadow-md ${
        "highlighted" in plan && plan.highlighted
          ? "border-blue-200 ring-2 ring-blue-100"
          : "border-zinc-200"
      }`}
    >
      {"highlighted" in plan && plan.highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
          推荐
        </span>
      )}

      <div className="mb-4 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: plan.accentColor }}
        />
        <h3 className="text-lg font-semibold text-zinc-900">{plan.name}</h3>
      </div>

      <p className="text-3xl font-bold tracking-tight text-zinc-900">
        {plan.price}
      </p>
      {"priceNote" in plan && plan.priceNote && (
        <p className="mt-1 text-sm text-zinc-500">{plan.priceNote}</p>
      )}

      <div className="my-6 h-px bg-zinc-100" />

      <ul className="flex flex-1 flex-col gap-3 text-sm text-zinc-600">
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <span>{plan.standardQuota}</span>
        </li>
        {"premiumQuota" in plan && plan.premiumQuota && (
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span>{plan.premiumQuota}</span>
          </li>
        )}
      </ul>

      <div className="mt-6 space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            普通模型
          </p>
          <div className="flex flex-wrap gap-1.5">
            {plan.standardModels.map((model) => (
              <span
                key={model}
                className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600"
              >
                {model}
              </span>
            ))}
          </div>
        </div>
        {"premiumModels" in plan && plan.premiumModels && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
              高级模型
            </p>
            <div className="flex flex-wrap gap-1.5">
              {plan.premiumModels.map((model) => (
                <span
                  key={model}
                  className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700"
                >
                  {model}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 via-white to-blue-50/40 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white">
              AI
            </div>
            <span className="text-lg font-semibold">AI Link</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-zinc-600 sm:flex">
            <a href="#features" className="transition hover:text-zinc-900">
              产品亮点
            </a>
            <a href="#pricing" className="transition hover:text-zinc-900">
              套餐档位
            </a>
            <a href="#download" className="transition hover:text-zinc-900">
              立即使用
            </a>
          </nav>
          <a
            href={PWA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm rounded-full px-4"
          >
            立即体验
          </a>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pt-20">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-blue-200/30 blur-3xl" />
            <div className="absolute right-0 top-32 h-64 w-64 rounded-full bg-indigo-100/50 blur-3xl" />
          </div>

          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-4 py-1.5 text-sm text-blue-700">
              <Sparkles className="h-4 w-4" />
              低成本使用海外 AI
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              一个 App，
              <br className="hidden sm:block" />
              连接全球顶尖 AI 模型
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg">
              AI Link 帮你以更低成本访问 DeepSeek、ChatGPT、Claude 等海外大模型。
              无需复杂配置，打开即用，适合日常问答、写作与灵感探索。
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={PWA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg w-full rounded-full px-8 sm:w-auto"
              >
                <Globe className="h-5 w-5" />
                PWA 直接访问
              </a>
              <a
                href={APK_URL}
                className="btn btn-outline btn-lg w-full rounded-full border-zinc-300 px-8 sm:w-auto"
              >
                <Smartphone className="h-5 w-5" />
                下载安卓 APK
              </a>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              {MODELS.map((model) => (
                <div
                  key={model.name}
                  className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-2.5 shadow-sm"
                >
                  <span className={`h-2 w-2 rounded-full ${model.color}`} />
                  <span className="text-sm font-medium text-zinc-700">
                    {model.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">为什么选择 AI Link</h2>
              <p className="mt-3 text-zinc-600">
                简单、实惠、覆盖主流海外模型，满足日常与进阶使用需求
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {FEATURES.map((feature, index) => {
                const icons = [Zap, Sparkles, Globe];
                const Icon = icons[index] ?? Sparkles;
                return (
                  <div
                    key={feature}
                    className="rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-base leading-relaxed text-zinc-700">
                      {feature}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">套餐档位</h2>
              <p className="mt-3 text-zinc-600">
                从免费体验到无限畅用，按需选择适合你的方案
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {PLANS.map((plan) => (
                <PlanCard key={plan.tier} plan={plan} />
              ))}
            </div>
          </div>
        </section>

        {/* Download CTA */}
        <section id="download" className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-xl sm:p-12">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-2xl font-bold sm:text-3xl">立即开始使用</h2>
                <p className="mt-4 text-blue-100">
                  无需安装即可通过 PWA 访问，安卓用户也可下载 APK 安装使用
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <a
                    href={PWA_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 rounded-2xl bg-white/10 p-6 transition hover:bg-white/20"
                  >
                    <Globe className="h-8 w-8" />
                    <span className="font-semibold">PWA 网页版</span>
                    <span className="flex items-center gap-1 text-sm text-blue-100">
                      ai.aizeten.me
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </a>
                  <a
                    href={APK_URL}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-white/10 p-6 transition hover:bg-white/20"
                  >
                    <Smartphone className="h-8 w-8" />
                    <span className="font-semibold">安卓 APK</span>
                    <span className="text-sm text-blue-100">点击下载安装包</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/60 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-zinc-500 sm:flex-row">
          <p>© {new Date().getFullYear()} AI Link. 保留所有权利。</p>
          <a
            href={PWA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition hover:text-zinc-800"
          >
            访问 ai.aizeten.me
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </footer>
    </div>
  );
}
