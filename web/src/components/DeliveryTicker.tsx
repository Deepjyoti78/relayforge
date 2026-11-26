import './DeliveryTicker.css';

const events = [
  { name: 'order.created', state: '202 accepted', tone: 'success', symbol: '↗' },
  { name: 'signature.hmac', state: 'verified', tone: 'success', symbol: '✓' },
  { name: 'destination.primary', state: '200 delivered', tone: 'success', symbol: '↗' },
  { name: 'destination.analytics', state: '500 · retry queued', tone: 'retry', symbol: '↻' },
  { name: 'delivery.replay', state: 'queued', tone: 'neutral', symbol: '→' },
  { name: 'duplicate.event', state: 'deduplicated', tone: 'neutral', symbol: '=' },
];

export function DeliveryTicker() {
  return <section className="rf-delivery-ticker" aria-label="Webhook delivery preview">
    <div className="rf-ticker-heading">
      <div><span className="rf-ticker-indicator" aria-hidden="true" />Delivery activity<span className="rf-ticker-demo">Illustrative stream</span></div>
    </div>
    <div className="rf-ticker-window">
      <div className="rf-ticker-track">
        {[false, true].map(duplicate => <ul className="rf-ticker-events" key={String(duplicate)} aria-hidden={duplicate || undefined}>
          {events.map(event => <li key={event.name}>
            <span className="rf-ticker-event">{event.name}</span>
            <span className={`rf-ticker-state rf-ticker-${event.tone}`}><span aria-hidden="true">{event.symbol}</span> {event.state}</span>
          </li>)}
        </ul>)}
      </div>
    </div>
    <div className="rf-ticker-caption"><span>INGEST → ROUTE → DELIVER</span><span>Sample events. No customer data.</span></div>
  </section>;
}
