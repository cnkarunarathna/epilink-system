import { NextResponse } from "next/server";

const CHATBOT_SERVICE_URL =
  process.env.CHATBOT_SERVICE_URL || "http://localhost:8002";

export async function POST() {
  try {
    const upstream = await fetch(`${CHATBOT_SERVICE_URL}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[chatbot session proxy] upstream error:", error);
    return NextResponse.json(
      { error: "Chatbot service unavailable" },
      { status: 503 }
    );
  }
}
