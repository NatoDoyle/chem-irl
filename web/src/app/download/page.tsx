import { BRAND_COLORS } from "@/config/brand";

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            Get Chem IRL
          </h1>
          <p className="text-xl text-slate-600 mb-12">
            Download the app to start meeting people face-to-face faster.
          </p>

          {/* App Store Links */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <a
              href="https://apps.apple.com/app/chem-irl"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              Download on the App Store
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=app.chemirl.mobile"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              Get it on Google Play
            </a>
          </div>

          {/* Waitlist Fallback */}
          <div className="mt-12 p-6 bg-white rounded-lg shadow-sm max-w-md mx-auto">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              Coming Soon
            </h2>
            <p className="text-slate-600 mb-4">
              We&apos;re launching soon! Join the waitlist to be notified when the app is available.
            </p>
            <form className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Enter your email"
                className="border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                style={{ backgroundColor: BRAND_COLORS.primary }}
              >
                Join Waitlist
              </button>
            </form>
          </div>

          {/* Additional Info */}
          <div className="mt-12 text-sm text-slate-500">
            <p>Available on iOS and Android</p>
            <p className="mt-2">Currently in beta - Dublin area only</p>
          </div>
        </div>
      </main>
    </div>
  );
}

