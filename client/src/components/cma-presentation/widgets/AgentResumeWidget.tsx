import { Mail, Phone } from 'lucide-react';
import type { AgentProfile } from '../types';

interface AgentResumeWidgetProps {
  agent: AgentProfile;
}

export function AgentResumeWidget({ agent }: AgentResumeWidgetProps) {
  return (
    <div className="flex flex-col h-full bg-background" data-testid="agent-resume-widget">
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Left column - Agent photo and contact */}
            <div className="flex flex-col items-center md:items-start gap-4 md:w-1/3">
              {agent.photo ? (
                <img
                  src={agent.photo}
                  alt={agent.name}
                  className="w-40 h-40 md:w-48 md:h-48 rounded-lg object-cover shadow-md"
                />
              ) : (
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-lg bg-muted flex items-center justify-center">
                  <span className="text-4xl font-semibold text-muted-foreground">
                    {agent.name?.charAt(0) || 'A'}
                  </span>
                </div>
              )}
              
              <div className="text-center md:text-left">
                <h2 className="text-xl md:text-2xl font-semibold">{agent.name}</h2>
                <p className="text-muted-foreground">{agent.company}</p>
              </div>

              {/* Contact info */}
              <div className="flex flex-col gap-2 text-sm">
                {agent.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{agent.phone}</span>
                  </div>
                )}
                {agent.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{agent.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right column - Bio */}
            <div className="flex-1 md:w-2/3">
              {agent.bio ? (
                <div className="prose dark:prose-invert max-w-none">
                  {agent.bio.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="text-base leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-lg text-muted-foreground">
                    Professional bio not available.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Go to Settings → Bio & Default Cover Letter to add your professional bio.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
