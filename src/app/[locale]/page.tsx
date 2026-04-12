import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import Link from 'next/link'

export default function LandingPage({ params }: { params: { locale: string } }) {
  const { locale } = params

  const features = [
    { icon: '📞', title: 'Proactive Check-ins', desc: 'Outbound calls for symptom collection and adherence tracking' },
    { icon: '🏥', title: 'Inbound Requests', desc: 'Handles refills, scheduling, and patient questions autonomously' },
    { icon: '🧠', title: '3-Layer NLP Pipeline', desc: 'Rules + context enrichment + Groq reasoning for high accuracy' },
    { icon: '🔴', title: 'Smart Escalation', desc: 'Safety triggers with negation detection — no false alarms' },
    { icon: '📊', title: 'Patient Dashboard', desc: 'Real-time corrections feed back into the next call' },
    { icon: '🔁', title: 'Event-Driven Automation', desc: 'Doctor changes, severity scores, and corrections trigger smart workflows' },
  ]

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="py-16 text-center">
        <GlassBadge color="cyan" className="mb-4">Healthcare Voice AI</GlassBadge>
        <h1 className="text-4xl font-bold text-white mb-4">
          CareCaller <span className="text-blue-400">AI</span>
        </h1>
        <p className="text-lg text-white/60 max-w-xl mx-auto">
          Owns what happens between appointments. Calls patients, understands them accurately, acts intelligently.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link href={`/${locale}/dashboard/demo-patient-token-abc123`}
            className="rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 px-6 py-2.5 text-sm font-medium transition-colors">
            View Patient Dashboard →
          </Link>
          <Link href={`/${locale}/clinician/00000000-0000-0000-0000-000000000002`}
            className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 px-6 py-2.5 text-sm font-medium transition-colors">
            View Clinician View
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
        {features.map((f) => (
          <GlassCard key={f.title}>
            <span className="text-2xl">{f.icon}</span>
            <h3 className="mt-2 font-medium text-white">{f.title}</h3>
            <p className="mt-1 text-sm text-white/50">{f.desc}</p>
          </GlassCard>
        ))}
      </div>

      {/* Pipeline */}
      <GlassCard glow>
        <h2 className="font-medium text-white mb-4">Real-Time Pipeline</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
          {['Vapi Telephony', '→', 'AssemblyAI Medical STT', '→', 'Layer 1: Rules', '→', 'Layer 2: Context', '→', 'Layer 3: Groq', '→', 'ElevenLabs TTS'].map((step) => (
            <span key={step} className={step === '→' ? 'text-blue-500' : 'px-2.5 py-1 rounded-lg bg-white/5 border border-white/10'}>
              {step}
            </span>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
