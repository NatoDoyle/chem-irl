import { BRAND, BRAND_COLORS, BRAND_MESSAGES } from "@/config/brand";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
            {BRAND.tagline}
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-8 max-w-2xl mx-auto">
            {BRAND.description}
          </p>
          
          {/* CTA Button */}
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-full text-lg transition-colors"
            style={{ backgroundColor: BRAND_COLORS.primary }}
          >
            Join the Dublin Beta
          </button>
        </div>

        {/* How it Works Section */}
        <div className="mt-20 max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            How it Works
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Like to Match</h3>
              <p className="text-slate-600">Swipe right on profiles you're interested in</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Propose 2–3 Times</h3>
              <p className="text-slate-600">Suggest 2–3 different times within 7 days</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">They Confirm</h3>
              <p className="text-slate-600">One tap to confirm or suggest alternatives</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">4</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Meet & Mark</h3>
              <p className="text-slate-600">Chat unlocks after confirm. Meet. Mark "went."</p>
            </div>
          </div>
        </div>

        {/* Key Features */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Why Chem IRL?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900 mb-2">72-Hour Rule</h3>
              <p className="text-slate-600">Proposals expire in 72 hours. No endless texting.</p>
            </div>
            
            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Structured Proposals</h3>
              <p className="text-slate-600">Exactly 2–3 times within 7 days. No vague plans.</p>
            </div>
            
            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Receiver-Paid Reopen</h3>
              <p className="text-slate-600">Expired? They can reopen with credits. Fair system.</p>
            </div>
          </div>
        </div>

        {/* Safety Section */}
        <div className="mt-20 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Safe & Transparent</h2>
          <p className="text-lg text-slate-600 mb-8">
            Report tools, verification, and visible moderation timers. 
            We reward action, not endless chat.
          </p>
          <div className="text-sm text-slate-500">
            <p>Report response time: 24h typical</p>
            <p>Verification required for top exposure</p>
          </div>
        </div>
      </main>
    </div>
  );
}
