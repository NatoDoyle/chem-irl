import { BRAND_COLORS } from "@/config/brand";

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 text-center">
            How It Works
          </h1>
          <p className="text-xl text-slate-600 mb-12 text-center">
            Get from match to meeting in days, not weeks.
          </p>

          <div className="space-y-12">
            {/* Step 1 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold text-blue-600">1</span>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-slate-900 mb-3">
                  Like to Match
                </h2>
                <p className="text-lg text-slate-600">
                  Swipe right on profiles you&apos;re interested in. When you both like each other, you match.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold text-blue-600">2</span>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-slate-900 mb-3">
                  Propose 2–3 Times
                </h2>
                <p className="text-lg text-slate-600">
                  Suggest exactly 2–3 different times within the next 7 days. Add a first-date type and a one-line note.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold text-blue-600">3</span>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-slate-900 mb-3">
                  They Confirm
                </h2>
                <p className="text-lg text-slate-600">
                  One tap to confirm a time, or suggest 2–3 alternatives if none of the times suit you.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold text-blue-600">4</span>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-slate-900 mb-3">
                  Meet & Mark
                </h2>
                <p className="text-lg text-slate-600">
                  Chat unlocks after you confirm. Meet in person. Mark that you went. Rate the experience.
                </p>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="mt-16 pt-12 border-t border-slate-200">
            <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
              What Makes Us Different
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 bg-white rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">72-Hour Rule</h3>
                <p className="text-slate-600">
                  Proposals expire in 72 hours. No endless texting. No ghosting.
                </p>
              </div>
              <div className="p-6 bg-white rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Structured Proposals</h3>
                <p className="text-slate-600">
                  Exactly 2–3 times within 7 days. No vague &quot;maybe this weekend&quot; plans.
                </p>
              </div>
              <div className="p-6 bg-white rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Receiver-Paid Reopen</h3>
                <p className="text-slate-600">
                  Expired? They can reopen with credits. Fair system that rewards action.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <a
              href="/download"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-full text-lg transition-colors"
              style={{ backgroundColor: BRAND_COLORS.primary }}
            >
              Download the App
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

