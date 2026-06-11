import { Link } from "react-router-dom";

import {
  BoltIcon,
  BotIcon,
  ChatBubbleIcon,
  CircleCheckIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { useSession } from "@/lib/session";
import "@/styles/home.css";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function HomePage() {
  const { customer } = useSession();

  return (
    <div className="home">
      <nav>
        <div className="brand">
          <div className="mark">
            <BoltIcon />
          </div>
          <b>KaranKart</b>
        </div>
        <div className="links">
          <Link to="/orders">Orders</Link>
          <Link to="/chat">Support</Link>
          {customer ? (
            <div className="me" title={customer.name}>
              {initials(customer.name)}
            </div>
          ) : (
            <Link to="/">Sign in</Link>
          )}
        </div>
      </nav>

      <div className="hero">
        <span className="pill">
          <i />
          AI support online · avg resolution 54s
        </span>
        <h1>
          Electronics, delivered.
          <br />
          Problems, resolved in a minute.
        </h1>
        <p className="sub">
          Track your orders and request refunds through an AI assistant that checks every decision
          against our return policy — instantly, transparently.
        </p>
        <div className="ctas">
          <Link to="/chat" className="btn primary">
            <ChatBubbleIcon />
            Get support
          </Link>
          <a href="#how" className="btn">
            How it works
          </a>
        </div>
      </div>

      <div className="how" id="how">
        <p className="how-label">HOW REFUNDS WORK</p>
        <div className="steps">
          <div className="stepc">
            <span className="num">01</span>
            <div className="ic">
              <ChatBubbleIcon />
            </div>
            <b>Tell the assistant</b>
            <p>Chat or speak. It finds your order from your email — no forms, no hold music.</p>
          </div>
          <div className="stepc">
            <span className="num">02</span>
            <div className="ic">
              <ShieldCheckIcon />
            </div>
            <b>Policy check</b>
            <p>
              Every request runs through our return policy — the 30-day window, item condition, and
              order history.
            </p>
          </div>
          <div className="stepc">
            <span className="num">03</span>
            <div className="ic">
              <CircleCheckIcon />
            </div>
            <b>Instant decision</b>
            <p>
              Eligible refunds are issued on the spot. Anything over ₹50,000 goes to a manager
              within 24 hours.
            </p>
          </div>
        </div>
      </div>

      <div className="strip">
        <div className="strip-inner">
          <div className="bot">
            <BotIcon />
          </div>
          <div>
            <b>Need help right now?</b>
            <small>The refund assistant is online — most cases close in under a minute</small>
          </div>
          <span className="sp" />
          <Link to="/chat" className="btn primary">
            Start a chat
          </Link>
        </div>
      </div>

      <p className="foot">
        30-day returns on sealed items · Defective items always covered · Refunds checked by our
        policy engine
      </p>
    </div>
  );
}
