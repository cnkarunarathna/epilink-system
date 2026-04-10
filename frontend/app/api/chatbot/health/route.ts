import { NextResponse } from "next/server";

const CHATBOT_SERVICE_URL =
  process.env.CHATBOT_SERVICE_URL || "http://localhost:8002";

export async function GET() {
  try {
    const upstream = await fetch(`${CHATBOT_SERVICE_URL}/health`, {
      next: { revalidate: 0 },
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[chatbot health proxy] upstream error:", error);
    return NextResponse.json(
      { error: "Chatbot service unavailable" },
      { status: 503 }
    );
  }
}
