import type { BatchEventItem, LeadItem } from "@/lib/api";

const visibleEventLimit = 24;

function transitionLabel(event: BatchEventItem): string {
  if (!event.fromStatus) return event.toStatus ?? event.type;
  return `${event.fromStatus} → ${event.toStatus ?? "—"}`;
}

function eventTime(value: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function PipelineEvents({ events, leads }: { events: BatchEventItem[]; leads: LeadItem[] }) {
  const leadNames = new Map(leads.map((lead) => [lead.id, lead.legalName]));
  const visibleEvents = events.slice(0, visibleEventLimit);

  return (
    <section className="surface pipelineEvents" aria-live="polite">
      <div className="pipelineEventsHeader">
        <div>
          <h2>Actividad del pipeline</h2>
          <p>Las transiciones persistidas aparecen aquí sin recargar la página.</p>
        </div>
        <span>{Math.min(events.length, visibleEventLimit)} eventos recientes</span>
      </div>
      {visibleEvents.length === 0 ? (
        <div className="empty pipelineEventsEmpty">Aún no hay transiciones.</div>
      ) : (
        <ol className="pipelineEventList">
          {visibleEvents.map((event) => {
            const subject = event.leadId ? leadNames.get(event.leadId) ?? `Lead ${event.leadId}` : "Batch";
            const status = event.toStatus ?? "event";
            return (
              <li className="pipelineEvent" key={event.id}>
                <span className={`pipelineEventDot ${status}`} aria-hidden="true" />
                <div className="pipelineEventBody">
                  <strong>{subject}</strong>
                  <span>{transitionLabel(event)}</span>
                </div>
                <time dateTime={event.createdAt}>{eventTime(event.createdAt)}</time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
