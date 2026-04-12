import { GlassCard } from "@/components/ui/GlassCard";

interface PatientMessage {
  id: string;
  message: string;
  status: string;
  created_at: string;
}

export function PatientMessages({ messages }: { messages: PatientMessage[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-medium text-white/50 uppercase tracking-wider">
        Patient Messages
      </h2>
      {!messages.length ? (
        <p className="text-sm text-white/30">No messages yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {messages.map((msg) => (
            <GlassCard key={msg.id} className="flex items-start gap-3">
              {msg.status === "pending" && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80">{msg.message}</p>
                <p className="text-xs text-white/30 mt-0.5">
                  {new Date(msg.created_at).toLocaleString()}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </section>
  );
}
