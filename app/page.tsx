export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans">
      <header className="border-b border-white/10 bg-zinc-950/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              className="flex-shrink-0"
              aria-label="PropertyManager logo"
            >
              <rect
                width="36"
                height="36"
                rx="8"
                fill="#0a0a0a"
                stroke="#3b82f6"
                strokeWidth="1.5"
              />
              <path
                d="M18 8 L28 16 L28 28 L8 28 L8 16 Z"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="14" y="20" width="8" height="8" fill="#3b82f6" opacity="0.4" />
            </svg>
            <div>
              <div className="font-semibold text-2xl tracking-tighter">
                PropertyManager
              </div>
              <div className="text-[10px] text-blue-400 -mt-1">
                PROPERTY MANAGEMENT PLATFORM
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-semibold tracking-tighter mb-3">
            Manage properties with confidence
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl">
            Track units, tenants, leases, and maintenance in one place. Built
            for landlords and property managers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Properties",
              description: "Organize buildings, units, and key details.",
            },
            {
              title: "Tenants",
              description: "Manage leases, contacts, and rent collection.",
            },
            {
              title: "Maintenance",
              description: "Track work orders and vendor requests.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-zinc-900 p-6"
            >
              <div className="font-semibold text-lg mb-2">{item.title}</div>
              <p className="text-sm text-zinc-400">{item.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}