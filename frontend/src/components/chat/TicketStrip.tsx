import { CheckCircleIcon } from "@/components/icons";

export function TicketStrip({ ticketRef }: { ticketRef: string }) {
  return (
    <div className="ticket">
      <CheckCircleIcon />
      <span>
        Ticket <b>#{ticketRef}</b> raised · response within 24 hours
      </span>
    </div>
  );
}
