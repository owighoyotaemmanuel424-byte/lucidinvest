import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
const MAX_NAME = 120, MAX_EMAIL = 254, MAX_SUBJECT = 160, MAX_MESSAGE = 5000;

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 }); }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const name = clean(data.name, MAX_NAME);
  const email = clean(data.email, MAX_EMAIL)?.toLowerCase();
  const message = clean(data.message, MAX_MESSAGE);
  const subject = typeof data.subject === "string" ? data.subject.trim().slice(0, MAX_SUBJECT) : "";

  if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, message: "Enter a valid name, email, and message." }, { status: 400 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ success: false, message: "Contact service is temporarily unavailable." }, { status: 503 });
  }
  try {
    await getSql()`INSERT INTO contact_enquiries (name, email, subject, message) VALUES (${name}, ${email}, ${subject}, ${message})`;
    return NextResponse.json({ success: true, message: "Message received." }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, message: "Unable to save your message right now." }, { status: 503 });
  }
}
