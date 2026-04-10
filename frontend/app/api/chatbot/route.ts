import { NextRequest, NextResponse } from "next/server";

const CHATBOT_SERVICE_URL =
  process.env.CHATBOT_SERVICE_URL || "http://localhost:8002";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const upstream = await fetch(`${CHATBOT_SERVICE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[chatbot proxy] upstream error:", error);
    return NextResponse.json(
      { error: "Chatbot service unavailable" },
      { status: 503 }
    );
  }
}
