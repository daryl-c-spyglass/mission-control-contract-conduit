import type { AgentProfile } from '../types';

interface AgentResumeWidgetProps {
  agent: AgentProfile;
}

export function AgentResumeWidget({ agent }: AgentResumeWidgetProps) {
  return (
    <div className="flex flex-col h-full bg-background" data-testid="agent-resume-widget">
      <div className="bg-gray-900 text-white py-3 px-4 text-center flex-shrink-0">
        <span className="font-bold tracking-wider text-sm uppercase">
          AGENT RESUME
        </span>
      </div>
      
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          {agent.bio ? (
            <div className="prose dark:prose-invert max-w-none">
              {agent.bio.split('\n\n').map((paragraph, index) => (
                <p key={index} className="text-base md:text-lg leading-relaxed">
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
  );
}
